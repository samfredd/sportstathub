"""
OddSwitch Engine — Celery Task Definitions.

Master task: execute_translation_pipeline
  - Receives a job_id
  - Runs the 10-step pipeline
  - Updates job status on success/failure
  - Handles caching and notification

Browser tasks: resolve_booking_code, generate_booking_code
  - Routed to the isolated 'browser' queue
  - Called from within the pipeline
"""

from __future__ import annotations

import asyncio
import traceback

import structlog

from app.core.redaction import sensitive_fingerprint
from app.queue.celery_app import celery_app

logger = structlog.get_logger()


def _run_async(coro):
    """Run an async function from a sync Celery task."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@celery_app.task(
    name="app.queue.tasks.execute_translation_pipeline",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def execute_translation_pipeline(self, job_id: str) -> dict:
    """
    Master translation task.

    Runs the full 10-step pipeline for a given job_id.
    On failure, marks the job as failed with error details.
    """
    logger.info("pipeline_start", job_id=job_id, attempt=self.request.retries)

    try:
        result = _run_async(_execute_pipeline(job_id))
        logger.info("pipeline_complete", job_id=job_id)
        return result
    except Exception as exc:
        logger.error(
            "pipeline_failed",
            job_id=job_id,
            error=str(exc),
            traceback=traceback.format_exc(),
        )
        if self.request.retries < self.max_retries:
            # Keep the job non-terminal until Celery has exhausted its retry
            # budget; callers may continue polling the same tenant-owned job.
            raise self.retry(exc=exc)
        _run_async(_mark_job_failed(job_id, exc))
        raise


async def _execute_pipeline(job_id: str) -> dict:
    """Async pipeline execution — delegates to the pipeline orchestrator."""
    from app.workers.pipeline import TranslationPipeline

    pipeline = await TranslationPipeline.create()
    try:
        result = await pipeline.execute(job_id)
        return result
    finally:
        await pipeline.close()


async def _mark_job_failed(job_id: str, exc: Exception) -> None:
    """Mark a job as failed in the database."""
    from app.cache.redis_client import RedisCache
    from app.db.engine import get_session_factory
    from app.db.repository import JobRepository
    from app.schemas.enums import JobStatus

    session_factory = get_session_factory()
    async with session_factory() as session:
        repo = JobRepository(session)
        job = await repo.get_by_id(job_id)
        error_code = getattr(exc, "error_code", "PIPELINE_ERROR")
        await repo.fail(job_id, error_code, str(exc))
        await session.commit()
        if job:
            redis = await RedisCache.create()
            try:
                await redis.clear_dedup(
                    job.api_key_id, job.source_bookmaker, job.booking_code, job.target_bookmaker
                )
                await redis.set_job_status(job.api_key_id, job_id, {
                    "job_id": job_id,
                    "status": JobStatus.FAILED,
                    "error": {"code": error_code, "message": "Translation failed"},
                })
            finally:
                await redis.close()


@celery_app.task(
    name="app.queue.tasks.resolve_booking_code",
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    queue="browser",
)
def resolve_booking_code(self, bookmaker: str, code: str) -> dict:
    """
    Browser task: resolve a booking code to a raw slip.

    Runs in the isolated browser worker pool.
    Returns the raw slip as a JSON-serializable dict.
    """
    code_ref = sensitive_fingerprint(code)
    logger.info("resolve_start", bookmaker=bookmaker, code_ref=code_ref)

    try:
        result = _run_async(_resolve(bookmaker, code))
        logger.info("resolve_complete", bookmaker=bookmaker, code_ref=code_ref)
        return result
    except Exception as exc:
        logger.error("resolve_failed", bookmaker=bookmaker, code_ref=code_ref, error=str(exc))
        raise self.retry(exc=exc)


async def _resolve(bookmaker: str, code: str) -> dict:
    """Async booking code resolution via browser adapter."""
    from app.browser.adapters import get_adapter

    adapter = await get_adapter(bookmaker)
    try:
        raw_slip = await adapter.resolve_booking_code(code)
        return raw_slip.model_dump(mode="json")
    finally:
        await adapter.close()


@celery_app.task(
    name="app.queue.tasks.generate_booking_code",
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    queue="browser",
)
def generate_booking_code(self, bookmaker: str, slip_data: dict) -> str:
    """
    Browser task: generate a booking code on the target bookmaker.

    Runs in the isolated browser worker pool.
    Returns the generated booking code string.
    """
    logger.info("generate_start", bookmaker=bookmaker)

    try:
        result = _run_async(_generate(bookmaker, slip_data))
        logger.info("generate_complete", bookmaker=bookmaker, code_ref=sensitive_fingerprint(result))
        return result
    except Exception as exc:
        logger.error("generate_failed", bookmaker=bookmaker, error=str(exc))
        raise self.retry(exc=exc)


async def _generate(bookmaker: str, slip_data: dict) -> str:
    """Async booking code generation via browser adapter."""
    from app.browser.adapters import get_adapter

    adapter = await get_adapter(bookmaker)
    try:
        code = await adapter.generate_booking_code(slip_data)
        return code
    finally:
        await adapter.close()
