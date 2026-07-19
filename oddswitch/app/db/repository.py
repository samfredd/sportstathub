"""
OddSwitch Engine — Data Access Layer.

Repository pattern isolating all database queries behind typed methods.
Each repository class owns one table's operations.
"""

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    ApiKey,
    CanonicalSlipRecord,
    EventMapping,
    MarketMapping,
    TeamAlias,
    TranslationJob,
)
from app.schemas.enums import JobStatus

# ── Job Repository ──────────────────────────────────────────────────────────


class JobRepository:
    """CRUD operations for translation_jobs table."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        source_bookmaker: str,
        target_bookmaker: str,
        booking_code: str,
        callback_url: str | None = None,
        api_key_id: str,
    ) -> TranslationJob:
        """Create a new translation job in QUEUED state."""
        job = TranslationJob(
            source_bookmaker=source_bookmaker,
            target_bookmaker=target_bookmaker,
            booking_code=booking_code,
            status=JobStatus.QUEUED,
            callback_url=callback_url,
            api_key_id=api_key_id,
        )
        self.session.add(job)
        await self.session.flush()
        return job

    async def get_by_id(self, job_id: str, api_key_id: str | None = None) -> TranslationJob | None:
        """Fetch a job, scoped to its tenant for every API-facing read."""
        stmt = select(TranslationJob).where(TranslationJob.id == job_id)
        if api_key_id is not None:
            stmt = stmt.where(TranslationJob.api_key_id == api_key_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_status(
        self, job_id: str, status: JobStatus
    ) -> None:
        """Update job status."""
        stmt = (
            update(TranslationJob)
            .where(TranslationJob.id == job_id)
            .values(status=status)
        )
        await self.session.execute(stmt)

    async def complete(
        self, job_id: str, result_json: dict
    ) -> None:
        """Mark job as completed with result."""
        stmt = (
            update(TranslationJob)
            .where(TranslationJob.id == job_id)
            .values(
                status=JobStatus.COMPLETED,
                result_json=result_json,
                completed_at=datetime.now(timezone.utc),
            )
        )
        await self.session.execute(stmt)

    async def fail(
        self, job_id: str, error_code: str, error_message: str
    ) -> None:
        """Mark job as failed with error details."""
        stmt = (
            update(TranslationJob)
            .where(TranslationJob.id == job_id)
            .values(
                status=JobStatus.FAILED,
                error_code=error_code,
                error_message=error_message,
                completed_at=datetime.now(timezone.utc),
            )
        )
        await self.session.execute(stmt)

    async def find_existing(
        self,
        source_bookmaker: str,
        booking_code: str,
        target_bookmaker: str,
        api_key_id: str,
    ) -> TranslationJob | None:
        """Find an existing active job for the same translation request."""
        stmt = (
            select(TranslationJob)
            .where(
                TranslationJob.source_bookmaker == source_bookmaker,
                TranslationJob.booking_code == booking_code,
                TranslationJob.target_bookmaker == target_bookmaker,
                TranslationJob.api_key_id == api_key_id,
                TranslationJob.status.in_([JobStatus.QUEUED, JobStatus.PROCESSING]),
            )
            .order_by(TranslationJob.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


# ── Slip Repository ─────────────────────────────────────────────────────────


class SlipRepository:
    """CRUD operations for canonical_slips table."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find_by_hash(self, slip_hash: str) -> CanonicalSlipRecord | None:
        """Find a canonical slip by its content hash."""
        stmt = select(CanonicalSlipRecord).where(
            CanonicalSlipRecord.hash == slip_hash
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        slip_hash: str,
        normalized_json: dict,
        source_bookmaker: str,
        source_code: str,
    ) -> CanonicalSlipRecord:
        """Store a new canonical slip."""
        record = CanonicalSlipRecord(
            hash=slip_hash,
            normalized_json=normalized_json,
            source_bookmaker=source_bookmaker,
            source_code=source_code,
        )
        self.session.add(record)
        await self.session.flush()
        return record


# ── Mapping Repository ──────────────────────────────────────────────────────


class MappingRepository:
    """Read operations for event_mappings, market_mappings, and team_aliases."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find_event_mapping(
        self,
        source_event: str,
        source_bookmaker: str,
        target_bookmaker: str,
    ) -> EventMapping | None:
        """Look up a known event mapping."""
        stmt = select(EventMapping).where(
            EventMapping.source_event == source_event,
            EventMapping.source_bookmaker == source_bookmaker,
            EventMapping.target_bookmaker == target_bookmaker,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def find_market_mapping(
        self,
        source_market: str,
        source_bookmaker: str,
        target_bookmaker: str,
    ) -> MarketMapping | None:
        """Look up a known market mapping."""
        stmt = select(MarketMapping).where(
            MarketMapping.source_market == source_market,
            MarketMapping.source_bookmaker == source_bookmaker,
            MarketMapping.target_bookmaker == target_bookmaker,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def find_canonical_name(
        self,
        alias: str,
        bookmaker: str | None = None,
    ) -> str | None:
        """Resolve a team alias to its canonical name.

        Checks bookmaker-specific alias first, then falls back to universal.
        """
        # Bookmaker-specific lookup
        if bookmaker:
            stmt = select(TeamAlias.canonical_name).where(
                TeamAlias.alias == alias,
                TeamAlias.bookmaker == bookmaker,
            )
            result = await self.session.execute(stmt)
            name = result.scalar_one_or_none()
            if name:
                return name

        # Universal fallback
        stmt = select(TeamAlias.canonical_name).where(
            TeamAlias.alias == alias,
            TeamAlias.bookmaker.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_event_mapping(
        self,
        *,
        source_event: str,
        target_event: str,
        source_bookmaker: str,
        target_bookmaker: str,
        confidence: float = 1.0,
    ) -> EventMapping:
        """Store a new event mapping."""
        mapping = EventMapping(
            source_event=source_event,
            target_event=target_event,
            source_bookmaker=source_bookmaker,
            target_bookmaker=target_bookmaker,
            confidence=confidence,
        )
        self.session.add(mapping)
        await self.session.flush()
        return mapping


# ── API Key Repository ──────────────────────────────────────────────────────


class ApiKeyRepository:
    """Lookup operations for api_keys table."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find_by_hash(self, key_hash: str) -> ApiKey | None:
        """Find an active API key by its hash."""
        stmt = select(ApiKey).where(
            ApiKey.key_hash == key_hash,
            ApiKey.is_active.is_(True),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
