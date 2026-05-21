"""
OddSwitch Engine — Webhook Notifier Worker.

Step 10: Notify clients via webhook on job completion.

POST result to callback_url with exponential backoff retry.
"""

from __future__ import annotations

import structlog
import httpx

from app.config import get_settings

logger = structlog.get_logger()


class NotifierWorker:
    """Delivers translation results to client webhook URLs."""

    def __init__(self) -> None:
        self._settings = get_settings()

    async def notify(
        self,
        job_id: str,
        callback_url: str,
        result: dict,
    ) -> bool:
        """
        POST the translation result to the client's webhook.

        Retries with exponential backoff on failure.
        Returns True if delivered, False if all attempts failed.
        """
        payload = {
            "job_id": job_id,
            "status": "completed",
            "result": result,
        }

        max_retries = self._settings.webhook_max_retries
        timeout = self._settings.webhook_timeout_seconds

        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        callback_url,
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    )
                    if response.status_code < 400:
                        logger.info(
                            "webhook_delivered",
                            job_id=job_id,
                            url=callback_url,
                            status=response.status_code,
                            attempt=attempt + 1,
                        )
                        return True

                    logger.warning(
                        "webhook_rejected",
                        job_id=job_id,
                        url=callback_url,
                        status=response.status_code,
                        attempt=attempt + 1,
                    )

            except Exception as exc:
                logger.warning(
                    "webhook_failed",
                    job_id=job_id,
                    url=callback_url,
                    error=str(exc),
                    attempt=attempt + 1,
                )

            # Exponential backoff: 1s, 2s, 4s
            if attempt < max_retries - 1:
                import asyncio
                await asyncio.sleep(2 ** attempt)

        logger.error(
            "webhook_exhausted",
            job_id=job_id,
            url=callback_url,
            max_retries=max_retries,
        )
        return False
