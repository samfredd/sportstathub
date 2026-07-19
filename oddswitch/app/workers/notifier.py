"""
OddSwitch Engine — Webhook Notifier Worker.

Step 10: Notify clients via webhook on job completion.

POST result to callback_url with exponential backoff retry.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from urllib.parse import urlsplit

import httpx
import structlog

from app.config import get_settings
from app.core.callback_security import validate_callback_url

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
        delivery_id = str(uuid.uuid4())
        timestamp = str(int(time.time()))
        payload = {
            "delivery_id": delivery_id,
            "event_type": "translation.completed",
            "timestamp": timestamp,
            "job_id": job_id,
            "status": "completed",
            "result": result,
        }

        max_retries = self._settings.webhook_max_retries
        timeout = self._settings.webhook_timeout_seconds
        body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
        signature = hmac.new(
            self._settings.webhook_signing_secret.encode(), body, hashlib.sha256
        ).hexdigest()

        for attempt in range(max_retries):
            try:
                # Resolve and revalidate on every attempt to limit DNS rebinding.
                callback_host, _ = await validate_callback_url(callback_url)
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
                    response = await client.post(
                        callback_url,
                        content=body,
                        headers={
                            "Content-Type": "application/json",
                            "X-OddSwitch-Delivery": delivery_id,
                            "X-OddSwitch-Timestamp": timestamp,
                            "X-OddSwitch-Event": "translation.completed",
                            "X-OddSwitch-Signature": f"sha256={signature}",
                        },
                    )
                    if response.status_code < 400:
                        logger.info(
                            "webhook_delivered",
                            job_id=job_id,
                            host=callback_host,
                            status=response.status_code,
                            attempt=attempt + 1,
                        )
                        return True

                    logger.warning(
                        "webhook_rejected",
                        job_id=job_id,
                        host=callback_host,
                        status=response.status_code,
                        attempt=attempt + 1,
                    )

            except Exception as exc:
                logger.warning(
                    "webhook_failed",
                    job_id=job_id,
                    host=urlsplit(callback_url).hostname,
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
            host=urlsplit(callback_url).hostname,
            max_retries=max_retries,
        )
        return False
