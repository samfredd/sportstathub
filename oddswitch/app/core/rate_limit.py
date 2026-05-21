"""
OddSwitch Engine — Redis-Backed Rate Limiter.

Sliding window counters per API key and per IP.
Defaults: 10 req/sec, 100 req/min.
Per-key overrides honored from api_keys.rate_limit_override.
"""

from __future__ import annotations

import time

from fastapi import Request

from app.cache.redis_client import RedisCache
from app.config import get_settings
from app.core.exceptions import RateLimitExceeded


async def check_rate_limit(
    request: Request,
    api_key_data: dict | None = None,
) -> None:
    """
    Enforce rate limits for the current request.

    Checks both per-second and per-minute windows.
    Uses Redis INCR + EXPIRE for atomic counter management.
    """
    settings = get_settings()
    redis_cache: RedisCache = request.app.state.redis
    client = redis_cache.client

    # Determine rate limit (per-key override or global default)
    per_second = settings.rate_limit_per_second
    per_minute = settings.rate_limit_per_minute

    if api_key_data and api_key_data.get("rate_limit_override"):
        per_second = api_key_data["rate_limit_override"]
        per_minute = per_second * 10  # Scale proportionally

    now = int(time.time())

    # Determine identity for rate limiting
    identity = "unknown"
    if api_key_data:
        identity = f"key:{api_key_data['id']}"
    else:
        identity = f"ip:{_get_client_ip(request)}"

    # ── Per-second check ─────────────────────────────────────
    sec_key = f"ratelimit:{identity}:{now}"
    sec_count = await client.incr(sec_key)
    if sec_count == 1:
        await client.expire(sec_key, 2)  # TTL slightly > 1s for safety

    if sec_count > per_second:
        raise RateLimitExceeded()

    # ── Per-minute check ─────────────────────────────────────
    minute_window = now // 60
    min_key = f"ratelimit:{identity}:m:{minute_window}"
    min_count = await client.incr(min_key)
    if min_count == 1:
        await client.expire(min_key, 120)  # TTL slightly > 60s

    if min_count > per_minute:
        raise RateLimitExceeded()


def _get_client_ip(request: Request) -> str:
    """Extract client IP, respecting X-Forwarded-For behind a proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "0.0.0.0"
