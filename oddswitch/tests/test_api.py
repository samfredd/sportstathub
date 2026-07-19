"""
OddSwitch Engine — API Endpoint Tests.

Tests for:
  - POST /v1/translate (job creation)
  - GET /v1/translate/{job_id} (status polling)
  - Authentication (missing/invalid API key)
  - Input validation (unsupported bookmaker, empty code)
  - Health check
"""

from __future__ import annotations

import pytest

from tests.conftest import TEST_API_KEY

# ── Health Check ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health_check(client):
    """Health endpoint returns ok with service statuses."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ok", "degraded")
    assert "version" in data
    assert "services" in data


# ── Job Creation ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_translation_job(client):
    """POST /v1/translate creates a job and returns 202."""
    response = await client.post(
        "/v1/translate",
        json={
            "source_bookmaker": "sportybet",
            "target_bookmaker": "bet9ja",
            "booking_code": "ABC123",
        },
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"


@pytest.mark.asyncio
async def test_create_translation_with_callback(client):
    """POST /v1/translate accepts optional callback_url."""
    response = await client.post(
        "/v1/translate",
        json={
            "source_bookmaker": "sportybet",
            "target_bookmaker": "bet9ja",
            "booking_code": "ABC123",
            "callback_url": "https://example.com/webhook",
        },
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert response.status_code == 202


# ── Authentication ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_missing_api_key(client):
    """Request without API key returns 401."""
    response = await client.post(
        "/v1/translate",
        json={
            "source_bookmaker": "sportybet",
            "target_bookmaker": "bet9ja",
            "booking_code": "ABC123",
        },
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_invalid_api_key(client):
    """Request with invalid API key returns 401."""
    response = await client.post(
        "/v1/translate",
        json={
            "source_bookmaker": "sportybet",
            "target_bookmaker": "bet9ja",
            "booking_code": "ABC123",
        },
        headers={"X-API-Key": "invalid-key"},
    )
    assert response.status_code == 401


# ── Input Validation ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unsupported_source_bookmaker(client):
    """Unsupported source bookmaker returns 422."""
    response = await client.post(
        "/v1/translate",
        json={
            "source_bookmaker": "fakebookie",
            "target_bookmaker": "bet9ja",
            "booking_code": "ABC123",
        },
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_unsupported_target_bookmaker(client):
    """Unsupported target bookmaker returns 422."""
    response = await client.post(
        "/v1/translate",
        json={
            "source_bookmaker": "sportybet",
            "target_bookmaker": "nonexistent",
            "booking_code": "ABC123",
        },
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_empty_booking_code(client):
    """Empty booking code returns 422."""
    response = await client.post(
        "/v1/translate",
        json={
            "source_bookmaker": "sportybet",
            "target_bookmaker": "bet9ja",
            "booking_code": "",
        },
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert response.status_code == 422


# ── Job Status ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_job_status(client):
    """GET /v1/translate/{job_id} returns job status."""
    response = await client.get(
        "/v1/translate/test-job-123",
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == "test-job-123"
    assert data["status"] == "queued"


@pytest.mark.asyncio
async def test_get_nonexistent_job(client):
    """GET /v1/translate/{bad_id} returns 404."""
    from unittest.mock import AsyncMock, patch

    with patch("app.api.v1.translate.JobRepository") as mock_cls:
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None
        mock_cls.return_value = mock_repo

        response = await client.get(
            "/v1/translate/nonexistent-job",
            headers={"X-API-Key": TEST_API_KEY},
        )
        assert response.status_code == 404
