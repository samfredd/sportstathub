"""
OddSwitch Engine — Translation Pipeline Orchestrator.

The strict 10-step pipeline that every translation job flows through.

  1. Check cache
  2. Resolve source booking code (→ browser worker)
  3. Normalize to canonical schema
  4. Match events
  5. Translate markets
  6. Score confidence
  7. Rebuild target slip
  8. Generate booking code (→ browser worker)
  9. Store result in Postgres
  10. Cache result + notify

Short-circuits on cache hit at step 1.
"""

from __future__ import annotations

import structlog

from app.cache.redis_client import RedisCache
from app.config import get_settings
from app.core.redaction import sensitive_fingerprint
from app.db.engine import get_session_factory
from app.db.repository import JobRepository, MappingRepository, SlipRepository
from app.schemas.canonical import CanonicalSlip
from app.schemas.enums import JobStatus
from app.workers.confidence import ConfidenceScorer
from app.workers.matcher import MatcherWorker
from app.workers.normalizer import NormalizerWorker
from app.workers.notifier import NotifierWorker
from app.workers.rehydrator import RehydratorWorker
from app.workers.resolver import ResolverWorker
from app.workers.translator import TranslatorWorker

logger = structlog.get_logger()


class TranslationPipeline:
    """
    Orchestrates the 10-step translation pipeline.

    Owns a database session and Redis connection for the duration
    of a single job execution. Call close() when done.
    """

    def __init__(
        self,
        redis: RedisCache,
    ) -> None:
        self._redis = redis
        self._settings = get_settings()

    @classmethod
    async def create(cls) -> "TranslationPipeline":
        """Factory: create pipeline with its own Redis connection."""
        redis = await RedisCache.create()
        return cls(redis=redis)

    async def close(self) -> None:
        """Release resources."""
        await self._redis.close()

    async def execute(self, job_id: str) -> dict:
        """
        Run the full 10-step pipeline.

        Returns the translation result as a JSON-serializable dict.
        Raises on unrecoverable failure.
        """
        session_factory = get_session_factory()

        async with session_factory() as session:
            job_repo = JobRepository(session)
            slip_repo = SlipRepository(session)
            mapping_repo = MappingRepository(session)

            # Load the job
            job = await job_repo.get_by_id(job_id)
            if not job:
                raise ValueError(f"Job {job_id} not found")

            source = job.source_bookmaker
            target = job.target_bookmaker
            code = job.booking_code
            tenant = job.api_key_id

            # ── Step 0: Mark as processing ───────────────────
            await job_repo.update_status(job_id, JobStatus.PROCESSING)
            await session.commit()

            log = logger.bind(job_id=job_id, source=source, target=target, code_ref=sensitive_fingerprint(code))

            # ── Step 1: Check cache ──────────────────────────
            log.info("step_1_cache_check")
            cached = await self._redis.get_translation(
                tenant, f"{source}:{code}", target
            )
            if cached:
                log.info("step_1_cache_hit")
                await job_repo.complete(job_id, cached)
                await session.commit()
                await self._redis.set_job_status(tenant, job_id, {
                    "job_id": job_id,
                    "status": JobStatus.COMPLETED,
                    "result": cached,
                })
                return cached

            # ── Step 2: Resolve booking code ─────────────────
            log.info("step_2_resolve")
            resolver = ResolverWorker(redis=self._redis)
            raw_slip = await resolver.resolve(tenant, source, code)
            log.info("step_2_resolved", legs=len(raw_slip.legs))

            # ── Step 3: Normalize ────────────────────────────
            log.info("step_3_normalize")
            normalizer = NormalizerWorker(
                mapping_repo=mapping_repo,
                slip_repo=slip_repo,
                session=session,
            )
            canonical = await normalizer.normalize(raw_slip)
            log.info("step_3_normalized", hash=canonical.hash)

            # ── Step 4: Match events ─────────────────────────
            log.info("step_4_match_events")
            matcher = MatcherWorker(mapping_repo=mapping_repo)
            event_matches = await matcher.match_events(canonical, target)
            log.info("step_4_matched", matches=len(event_matches))

            # ── Step 5: Translate markets ────────────────────
            log.info("step_5_translate_markets")
            translator = TranslatorWorker(mapping_repo=mapping_repo)
            market_translations = await translator.translate_markets(
                event_matches, source, target
            )
            log.info("step_5_translated", translations=len(market_translations))

            # ── Step 6: Score confidence ─────────────────────
            log.info("step_6_confidence")
            scorer = ConfidenceScorer()
            confidence_report = scorer.score(event_matches, market_translations)
            log.info(
                "step_6_scored",
                overall=confidence_report["confidence"],
                status=confidence_report["status"],
            )

            # ── Step 7: Rebuild target slip ──────────────────
            log.info("step_7_rebuild")
            rehydrator = RehydratorWorker(redis=self._redis)
            translated_slip = rehydrator.rebuild(
                target_bookmaker=target,
                canonical=canonical,
                event_matches=event_matches,
                market_translations=market_translations,
                confidence_report=confidence_report,
            )
            log.info("step_7_rebuilt")

            # ── Step 8: Generate booking code ────────────────
            log.info("step_8_generate_code")
            translated_code = await rehydrator.generate_code(
                target, translated_slip
            )
            log.info("step_8_generated", code_ref=sensitive_fingerprint(translated_code))

            # Build final result
            result = self._build_result(
                translated_code=translated_code,
                canonical=canonical,
                translated_slip=translated_slip,
                confidence_report=confidence_report,
            )

            # ── Step 9: Store result ─────────────────────────
            log.info("step_9_store")
            await job_repo.complete(job_id, result)
            await session.commit()

            # ── Step 10: Cache + notify ──────────────────────
            log.info("step_10_cache_notify")
            await self._redis.set_translation(
                tenant, f"{source}:{code}", target, result
            )
            await self._redis.set_job_status(tenant, job_id, {
                "job_id": job_id,
                "status": JobStatus.COMPLETED,
                "result": result,
            })
            await self._redis.clear_dedup(tenant, source, code, target)

            # Webhook notification
            if job.callback_url:
                notifier = NotifierWorker()
                await notifier.notify(job_id, job.callback_url, result)

            log.info("pipeline_complete")
            return result

    def _build_result(
        self,
        translated_code: str,
        canonical: CanonicalSlip,
        translated_slip: dict,
        confidence_report: dict,
    ) -> dict:
        """Assemble the final translation result."""
        source_odds = canonical.total_odds
        target_odds = translated_slip.get("total_odds", source_odds)

        legs = []
        for i, leg in enumerate(translated_slip.get("legs", [])):
            source_leg = canonical.legs[i] if i < len(canonical.legs) else None
            legs.append({
                "event": leg.get("event", source_leg.event_name if source_leg else ""),
                "market": leg.get("market", source_leg.market if source_leg else ""),
                "selection": leg.get("selection", source_leg.selection if source_leg else ""),
                "source_odds": source_leg.odds if source_leg else 0,
                "target_odds": leg.get("odds", 0),
                "confidence": leg.get("confidence", 0),
                "status": leg.get("status", "missing"),
            })

        return {
            "translated_code": translated_code,
            "confidence": confidence_report["confidence"],
            "status": confidence_report["status"],
            "source_odds": source_odds,
            "target_odds": target_odds,
            "odds_delta": round(abs(target_odds - source_odds), 4),
            "legs": legs,
        }
