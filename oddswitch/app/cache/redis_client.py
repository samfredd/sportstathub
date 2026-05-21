"""
OddSwitch Engine — Redis Cache Client.

Typed cache operations for all key patterns:
  bc:{bookmaker}:{code}       → resolved booking code data
  slip:{hash}                 → canonical slip JSON
  tx:{slip_hash}:{target}     → translation result JSON
  dedup:{source}:{code}:{tgt} → deduplication lock (stores job_id)
  job:{job_id}                → job status cache
  apikey:{key_hash}           → API key validation cache

All methods are async. TTLs configured via Settings.
"""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as aioredis

from app.config import get_settings


class RedisCache:
    """Async Redis cache wrapper with typed key operations."""

    def __init__(self, client: aioredis.Redis) -> None:
        self._client = client
        self._settings = get_settings()

    # ── Connection Lifecycle ─────────────────────────────────────

    @classmethod
    async def create(cls, url: str | None = None) -> "RedisCache":
        """Factory: create a RedisCache with a connected client."""
        settings = get_settings()
        client = aioredis.from_url(
            url or settings.redis_url,
            decode_responses=True,
        )
        return cls(client)

    async def close(self) -> None:
        """Close the underlying Redis connection."""
        await self._client.aclose()

    @property
    def client(self) -> aioredis.Redis:
        """Expose raw client for advanced operations (e.g., rate limiting)."""
        return self._client

    # ── Booking Code Cache ───────────────────────────────────────

    def _bc_key(self, bookmaker: str, code: str) -> str:
        return f"bc:{bookmaker}:{code}"

    async def get_booking_code(self, bookmaker: str, code: str) -> dict | None:
        """Retrieve cached booking code resolution."""
        data = await self._client.get(self._bc_key(bookmaker, code))
        return json.loads(data) if data else None

    async def set_booking_code(
        self, bookmaker: str, code: str, data: dict, *, prematch: bool = False
    ) -> None:
        """Cache a resolved booking code."""
        ttl = (
            self._settings.cache_ttl_booking_code_prematch
            if prematch
            else self._settings.cache_ttl_booking_code
        )
        await self._client.set(
            self._bc_key(bookmaker, code),
            json.dumps(data),
            ex=ttl,
        )

    # ── Canonical Slip Cache ─────────────────────────────────────

    def _slip_key(self, slip_hash: str) -> str:
        return f"slip:{slip_hash}"

    async def get_slip(self, slip_hash: str) -> dict | None:
        """Retrieve cached canonical slip."""
        data = await self._client.get(self._slip_key(slip_hash))
        return json.loads(data) if data else None

    async def set_slip(self, slip_hash: str, data: dict) -> None:
        """Cache a canonical slip."""
        await self._client.set(
            self._slip_key(slip_hash),
            json.dumps(data),
            ex=self._settings.cache_ttl_canonical_slip,
        )

    # ── Translation Result Cache ─────────────────────────────────

    def _tx_key(self, slip_hash: str, target: str) -> str:
        return f"tx:{slip_hash}:{target}"

    async def get_translation(self, slip_hash: str, target: str) -> dict | None:
        """Retrieve cached translation result."""
        data = await self._client.get(self._tx_key(slip_hash, target))
        return json.loads(data) if data else None

    async def set_translation(
        self, slip_hash: str, target: str, data: dict, *, prematch: bool = False
    ) -> None:
        """Cache a translation result."""
        ttl = (
            self._settings.cache_ttl_translation_prematch
            if prematch
            else self._settings.cache_ttl_translation
        )
        await self._client.set(
            self._tx_key(slip_hash, target),
            json.dumps(data),
            ex=ttl,
        )

    # ── Deduplication ────────────────────────────────────────────

    def _dedup_key(self, source: str, code: str, target: str) -> str:
        return f"dedup:{source}:{code}:{target}"

    async def check_dedup(self, source: str, code: str, target: str) -> str | None:
        """Check if a translation is already in-flight. Returns job_id or None."""
        return await self._client.get(self._dedup_key(source, code, target))

    async def set_dedup(self, source: str, code: str, target: str, job_id: str) -> None:
        """Register a deduplication lock for an in-flight job."""
        await self._client.set(
            self._dedup_key(source, code, target),
            job_id,
            ex=self._settings.cache_ttl_dedup,
        )

    async def clear_dedup(self, source: str, code: str, target: str) -> None:
        """Clear deduplication lock after job completes."""
        await self._client.delete(self._dedup_key(source, code, target))

    # ── Job Status Cache ─────────────────────────────────────────

    def _job_key(self, job_id: str) -> str:
        return f"job:{job_id}"

    async def get_job_status(self, job_id: str) -> dict | None:
        """Retrieve cached job status."""
        data = await self._client.get(self._job_key(job_id))
        return json.loads(data) if data else None

    async def set_job_status(self, job_id: str, data: dict) -> None:
        """Cache job status for fast polling."""
        await self._client.set(
            self._job_key(job_id),
            json.dumps(data),
            ex=self._settings.cache_ttl_job_status,
        )

    # ── API Key Cache ────────────────────────────────────────────

    def _apikey_key(self, key_hash: str) -> str:
        return f"apikey:{key_hash}"

    async def get_api_key(self, key_hash: str) -> dict | None:
        """Retrieve cached API key validation result."""
        data = await self._client.get(self._apikey_key(key_hash))
        return json.loads(data) if data else None

    async def set_api_key(self, key_hash: str, data: dict) -> None:
        """Cache API key validation result."""
        await self._client.set(
            self._apikey_key(key_hash),
            json.dumps(data),
            ex=self._settings.cache_ttl_api_key,
        )

    # ── Utility ──────────────────────────────────────────────────

    async def ping(self) -> bool:
        """Health check."""
        try:
            return await self._client.ping()
        except Exception:
            return False

    async def flush_pattern(self, pattern: str) -> int:
        """Delete all keys matching a glob pattern. Use carefully."""
        keys: list[Any] = []
        async for key in self._client.scan_iter(match=pattern, count=100):
            keys.append(key)
        if keys:
            return await self._client.delete(*keys)
        return 0
