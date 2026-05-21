"""
OddSwitch Engine — Dependency Injection.

FastAPI dependencies for database sessions, Redis, and auth.
Injected via Depends() in route handlers.
"""

from __future__ import annotations

from typing import AsyncGenerator

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.redis_client import RedisCache
from app.core.rate_limit import check_rate_limit
from app.core.security import get_current_api_key
from app.db.engine import get_session_factory


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session, auto-committing on success."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_redis(request: Request) -> RedisCache:
    """Return the app-level Redis cache instance."""
    return request.app.state.redis


async def get_authenticated_key(
    request: Request,
    api_key_data: dict = Depends(get_current_api_key),
) -> dict:
    """
    Combined auth + rate limit dependency.

    Authenticates the request, then enforces rate limits.
    Returns the API key metadata dict.
    """
    await check_rate_limit(request, api_key_data)
    return api_key_data
