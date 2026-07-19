"""
OddSwitch Engine — API Key Authentication.

Extracts the API key from request headers, hashes it, and validates
against the database (with Redis caching for hot-path performance).

The raw API key is NEVER stored — only its SHA-256 hash.
"""

from __future__ import annotations

import hashlib

from fastapi import Request

from app.cache.redis_client import RedisCache
from app.config import get_settings
from app.core.exceptions import AuthenticationError
from app.db.engine import get_session_factory
from app.db.repository import ApiKeyRepository


def hash_api_key(raw_key: str) -> str:
    """Produce the SHA-256 hash of a raw API key."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


async def get_current_api_key(request: Request) -> dict:
    """
    FastAPI dependency that authenticates the request via API key.

    Flow:
    1. Extract key from X-API-Key header
    2. Hash it
    3. Check Redis cache
    4. Fall back to Postgres lookup
    5. Cache on success
    6. Raise 401 on failure

    Returns a dict with key metadata: {id, name, rate_limit_override}
    """
    settings = get_settings()
    raw_key = request.headers.get(settings.api_key_header)

    if not raw_key:
        raise AuthenticationError()

    key_hash = hash_api_key(raw_key)

    # Check Redis cache first
    redis_cache: RedisCache = request.app.state.redis
    cached = await redis_cache.get_api_key(key_hash)
    if cached:
        return cached

    # Fall back to database
    session_factory = get_session_factory()
    async with session_factory() as session:
        repo = ApiKeyRepository(session)
        api_key = await repo.find_by_hash(key_hash)

        if not api_key:
            raise AuthenticationError()

        key_data = {
            "id": api_key.id,
            "name": api_key.name,
            "rate_limit_override": api_key.rate_limit_override,
        }

        # Cache for fast subsequent lookups
        await redis_cache.set_api_key(key_hash, key_data)

        return key_data
