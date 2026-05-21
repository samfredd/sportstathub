"""
OddSwitch Engine — Translation Endpoints.

POST /v1/translate — Create a translation job
GET  /v1/translate/{job_id} — Poll job status

These endpoints are synchronous for intake, asynchronous for execution.
A request never blocks on the translation pipeline.
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import (
    ErrorDetail,
    JobCreatedResponse,
    JobStatusResponse,
    TranslationResult,
)
from app.api.v1.schemas import TranslateRequest
from app.cache.redis_client import RedisCache
from app.core.exceptions import JobNotFound
from app.db.repository import JobRepository
from app.dependencies import get_authenticated_key, get_db, get_redis
from app.queue.tasks import execute_translation_pipeline
from app.schemas.enums import JobStatus

logger = structlog.get_logger()

router = APIRouter(tags=["translate"])


@router.post(
    "/translate",
    response_model=JobCreatedResponse,
    status_code=202,
    summary="Create a translation job",
    description="Accepts a booking code and queues it for async translation.",
)
async def create_translation(
    request: TranslateRequest,
    db: AsyncSession = Depends(get_db),
    redis: RedisCache = Depends(get_redis),
    api_key: dict = Depends(get_authenticated_key),
) -> JobCreatedResponse:
    """
    1. Check dedup → if in-flight, return existing job_id
    2. Check translation cache → if hit, return completed immediately
    3. Create job in Postgres
    4. Set dedup key in Redis
    5. Enqueue Celery task
    6. Return {job_id, status: "queued"}
    """
    source = request.source_bookmaker
    target = request.target_bookmaker
    code = request.booking_code

    # ── Step 1: Deduplication ────────────────────────────────
    existing_job_id = await redis.check_dedup(source, code, target)
    if existing_job_id:
        logger.info(
            "dedup_hit",
            job_id=existing_job_id,
            source=source,
            target=target,
            code=code,
        )
        # Return the existing job — client can poll for status
        job_repo = JobRepository(db)
        existing = await job_repo.get_by_id(existing_job_id)
        if existing:
            return JobCreatedResponse(
                job_id=existing.id,
                status=existing.status,
                result=(
                    TranslationResult(**existing.result_json)
                    if existing.status == JobStatus.COMPLETED and existing.result_json
                    else None
                ),
            )

    # ── Step 2: Cache check ──────────────────────────────────
    # We can't check translation cache without the slip hash,
    # but we can check if the exact booking code was translated before
    cached_result = await redis.get_booking_code(source, code)
    if cached_result and cached_result.get("translations", {}).get(target):
        tx_data = cached_result["translations"][target]
        logger.info("cache_hit", source=source, target=target, code=code)

        # Create a completed job for audit trail
        job_repo = JobRepository(db)
        job = await job_repo.create(
            source_bookmaker=source,
            target_bookmaker=target,
            booking_code=code,
            callback_url=request.callback_url,
            api_key_id=api_key["id"],
        )
        await job_repo.complete(job.id, tx_data)

        return JobCreatedResponse(
            job_id=job.id,
            status=JobStatus.COMPLETED,
            result=TranslationResult(**tx_data),
        )

    # ── Step 3: Create job ───────────────────────────────────
    job_repo = JobRepository(db)
    job = await job_repo.create(
        source_bookmaker=source,
        target_bookmaker=target,
        booking_code=code,
        callback_url=request.callback_url,
        api_key_id=api_key["id"],
    )

    logger.info("job_created", job_id=job.id, source=source, target=target, code=code)

    # ── Step 4: Set dedup key ────────────────────────────────
    await redis.set_dedup(source, code, target, job.id)

    # ── Step 5: Enqueue Celery task ──────────────────────────
    execute_translation_pipeline.delay(job.id)

    # ── Step 6: Return immediately ───────────────────────────
    return JobCreatedResponse(
        job_id=job.id,
        status=JobStatus.QUEUED,
    )


@router.get(
    "/translate/{job_id}",
    response_model=JobStatusResponse,
    summary="Get translation job status",
    description="Poll for the current status and result of a translation job.",
)
async def get_translation_status(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    redis: RedisCache = Depends(get_redis),
    api_key: dict = Depends(get_authenticated_key),
) -> JobStatusResponse:
    """
    1. Check Redis job cache first (fast path)
    2. Fall back to Postgres
    3. Return current status + result if completed
    """
    # ── Fast path: Redis cache ───────────────────────────────
    cached = await redis.get_job_status(job_id)
    if cached:
        return JobStatusResponse(**cached)

    # ── Slow path: Postgres ──────────────────────────────────
    job_repo = JobRepository(db)
    job = await job_repo.get_by_id(job_id)

    if not job:
        raise JobNotFound(job_id)

    response = JobStatusResponse(
        job_id=job.id,
        status=job.status,
        result=(
            TranslationResult(**job.result_json)
            if job.status == JobStatus.COMPLETED and job.result_json
            else None
        ),
        error=(
            ErrorDetail(code=job.error_code, message=job.error_message)
            if job.status == JobStatus.FAILED and job.error_code
            else None
        ),
    )

    # Cache the response for fast polling
    await redis.set_job_status(job_id, response.model_dump())

    return response
