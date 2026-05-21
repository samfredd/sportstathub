"""
OddSwitch Engine — Resolver Worker.

Step 2: Resolve a booking code into a raw slip.

Flow:
  1. Check Redis cache for previously resolved code
  2. If miss → call browser adapter to load code on bookmaker site
  3. Extract events, markets, selections, odds
  4. Cache the result
  5. Return structured RawSlip
"""

from __future__ import annotations

import structlog

from app.cache.redis_client import RedisCache
from app.schemas.canonical import RawLeg, RawSlip

logger = structlog.get_logger()


class ResolverWorker:
    """Resolves a bookmaker booking code into a structured raw slip."""

    def __init__(self, redis: RedisCache) -> None:
        self._redis = redis

    async def resolve(self, bookmaker: str, code: str) -> RawSlip:
        """
        Resolve a booking code to a RawSlip.

        Checks cache first. On miss, calls the browser adapter
        (routed to the browser queue for isolation).
        """
        # ── Cache check ──────────────────────────────────────
        cached = await self._redis.get_booking_code(bookmaker, code)
        if cached:
            logger.info("resolver_cache_hit", bookmaker=bookmaker, code=code)
            return RawSlip(**cached)

        # ── Browser resolution ───────────────────────────────
        logger.info("resolver_browser_call", bookmaker=bookmaker, code=code)

        from app.browser.adapters import get_adapter

        adapter = await get_adapter(bookmaker)
        try:
            raw_slip = await adapter.resolve_booking_code(code)
        finally:
            await adapter.close()

        # ── Cache the result ─────────────────────────────────
        await self._redis.set_booking_code(
            bookmaker, code, raw_slip.model_dump(mode="json")
        )

        return raw_slip
