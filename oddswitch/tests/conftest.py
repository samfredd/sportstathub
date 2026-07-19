"""
OddSwitch Engine — Test Fixtures.

Shared fixtures for async tests:
  - FastAPI test client with mocked auth
  - Fake Redis for cache testing
  - In-memory SQLite for DB testing
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.config import Settings
from app.core.security import hash_api_key

# ── Test Settings ────────────────────────────────────────────────────────────

TEST_API_KEY = "test-api-key-12345"
TEST_API_KEY_HASH = hash_api_key(TEST_API_KEY)


def get_test_settings() -> Settings:
    """Override settings for testing."""
    return Settings(
        database_url="sqlite+aiosqlite:///",
        redis_url="redis://localhost:6379/15",
        celery_broker_url="redis://localhost:6379/14",
        celery_result_backend="redis://localhost:6379/13",
        debug=True,
        log_format="console",
    )


# ── Mock Redis ───────────────────────────────────────────────────────────────


class MockRedisCache:
    """In-memory mock of RedisCache for testing."""

    def __init__(self):
        self._store: dict[str, str] = {}

    async def get_booking_code(self, tenant, bookmaker, code):
        return None

    async def set_booking_code(self, tenant, bookmaker, code, data, *, prematch=False):
        pass

    async def get_translation(self, tenant, slip_hash, target):
        return None

    async def set_translation(self, tenant, slip_hash, target, data, *, prematch=False):
        pass

    async def get_slip(self, slip_hash):
        return None

    async def set_slip(self, slip_hash, data):
        pass

    async def check_dedup(self, tenant, source, code, target):
        return self._store.get(f"{tenant}:dedup:{source}:{code}:{target}")

    async def set_dedup(self, tenant, source, code, target, job_id):
        self._store[f"{tenant}:dedup:{source}:{code}:{target}"] = job_id

    async def clear_dedup(self, tenant, source, code, target):
        self._store.pop(f"{tenant}:dedup:{source}:{code}:{target}", None)

    async def get_job_status(self, tenant, job_id):
        return None

    async def set_job_status(self, tenant, job_id, data):
        pass

    async def get_api_key(self, key_hash):
        if key_hash == TEST_API_KEY_HASH:
            return {"id": "test-key-id", "name": "test", "rate_limit_override": None}
        return None

    async def set_api_key(self, key_hash, data):
        pass

    async def ping(self):
        return True

    async def close(self):
        pass

    @property
    def client(self):
        return MockRedisClient()


class MockRedisClient:
    """Minimal mock for raw Redis client operations (rate limiting)."""

    def __init__(self):
        self._counters: dict[str, int] = {}

    async def incr(self, key):
        self._counters[key] = self._counters.get(key, 0) + 1
        return self._counters[key]

    async def expire(self, key, seconds):
        pass


# ── FastAPI Test Client ──────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def mock_redis():
    """Provide a mock Redis cache."""
    return MockRedisCache()


@pytest_asyncio.fixture
async def client(mock_redis):
    """
    Async HTTP test client for the FastAPI app.

    Patches:
      - Redis with MockRedisCache
      - Celery task with no-op
      - DB session with mock
    """
    from app.main import create_app

    app = create_app()
    app.state.redis = mock_redis

    # Create a mock session that works as an async context manager
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.flush = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.get = AsyncMock(return_value=None)

    class MockSessionFactory:
        """Mimics async_sessionmaker — calling it returns an async context manager."""
        def __call__(self):
            return self

        async def __aenter__(self):
            return mock_session

        async def __aexit__(self, *args):
            pass

    mock_factory_instance = MockSessionFactory()

    def mock_get_session_factory():
        return mock_factory_instance

    # Patch Celery task to not actually enqueue
    with patch(
        "app.api.v1.translate.execute_translation_pipeline"
    ) as mock_task:
        mock_task.delay = lambda job_id: None

        # Patch session factory in both dependencies AND security modules
        with patch("app.dependencies.get_session_factory", side_effect=mock_get_session_factory):
            with patch("app.core.security.get_session_factory", side_effect=mock_get_session_factory):

                # Patch ApiKeyRepository to return None for unknown keys
                with patch("app.core.security.ApiKeyRepository") as mock_akr_cls:
                    mock_akr = AsyncMock()
                    mock_akr.find_by_hash.return_value = None
                    mock_akr_cls.return_value = mock_akr

                    # Patch JobRepository
                    with patch("app.api.v1.translate.JobRepository") as mock_job_repo_cls:
                        mock_repo = AsyncMock()
                        mock_repo.create.return_value = type(
                            "Job", (), {"id": "test-job-123", "status": "queued"}
                        )()
                        mock_repo.get_by_id.return_value = type(
                            "Job",
                            (),
                            {
                                "id": "test-job-123",
                                "status": "queued",
                                "result_json": None,
                                "error_code": None,
                                "error_message": None,
                            },
                        )()
                        mock_job_repo_cls.return_value = mock_repo

                        transport = ASGITransport(app=app)
                        async with AsyncClient(
                            transport=transport, base_url="http://test"
                        ) as ac:
                            yield ac
