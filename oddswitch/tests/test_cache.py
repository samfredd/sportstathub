"""
OddSwitch Engine — Cache Tests.

Tests for RedisCache key operations, TTL behavior, and dedup logic.
Uses the MockRedisCache from conftest.
"""

from __future__ import annotations

import pytest

from tests.conftest import MockRedisCache


@pytest.mark.asyncio
async def test_dedup_set_and_check():
    """Dedup key stores and retrieves job_id."""
    cache = MockRedisCache()

    # Initially no dedup
    result = await cache.check_dedup("sportybet", "ABC", "bet9ja")
    assert result is None

    # Set dedup
    await cache.set_dedup("sportybet", "ABC", "bet9ja", "job-123")

    # Now should return job_id
    result = await cache.check_dedup("sportybet", "ABC", "bet9ja")
    assert result == "job-123"


@pytest.mark.asyncio
async def test_dedup_clear():
    """Dedup key is cleared after job completes."""
    cache = MockRedisCache()

    await cache.set_dedup("sportybet", "ABC", "bet9ja", "job-123")
    await cache.clear_dedup("sportybet", "ABC", "bet9ja")

    result = await cache.check_dedup("sportybet", "ABC", "bet9ja")
    assert result is None


@pytest.mark.asyncio
async def test_api_key_cache():
    """API key cache returns data for known keys."""
    from tests.conftest import TEST_API_KEY_HASH

    cache = MockRedisCache()
    result = await cache.get_api_key(TEST_API_KEY_HASH)
    assert result is not None
    assert result["name"] == "test"


@pytest.mark.asyncio
async def test_api_key_cache_miss():
    """API key cache returns None for unknown keys."""
    cache = MockRedisCache()
    result = await cache.get_api_key("unknown-hash")
    assert result is None


@pytest.mark.asyncio
async def test_ping():
    """Ping returns True."""
    cache = MockRedisCache()
    assert await cache.ping() is True
