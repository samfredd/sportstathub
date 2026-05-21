"""
OddSwitch Engine — API Request/Response Schemas.

Pydantic models for the v1 translation API.
These are the public contract — versioned and stable.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from app.core.exceptions import SUPPORTED_BOOKMAKERS


# ── Requests ─────────────────────────────────────────────────────────────────


class TranslateRequest(BaseModel):
    """POST /v1/translate request body."""

    source_bookmaker: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Source bookmaker identifier",
        examples=["sportybet"],
    )
    target_bookmaker: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Target bookmaker identifier",
        examples=["bet9ja"],
    )
    booking_code: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Booking code to translate",
        examples=["ABC123"],
    )
    callback_url: str | None = Field(
        default=None,
        max_length=500,
        description="Optional webhook URL for async result delivery",
        examples=["https://client.com/webhook"],
    )

    @field_validator("source_bookmaker", "target_bookmaker")
    @classmethod
    def validate_bookmaker(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in SUPPORTED_BOOKMAKERS:
            raise ValueError(
                f"Unsupported bookmaker '{v}'. Supported: {sorted(SUPPORTED_BOOKMAKERS)}"
            )
        return v

    @field_validator("booking_code")
    @classmethod
    def validate_booking_code(cls, v: str) -> str:
        return v.strip()


# ── Responses ────────────────────────────────────────────────────────────────


class LegResult(BaseModel):
    """Translation result for a single leg within a slip."""

    event: str
    market: str
    selection: str
    source_odds: float
    target_odds: float
    confidence: float = Field(..., ge=0, le=1)
    status: str  # exact | approximate | missing


class TranslationResult(BaseModel):
    """Complete translation result with confidence scoring."""

    translated_code: str
    confidence: float = Field(..., ge=0, le=1)
    status: str  # semantically_equivalent | approximate | partial
    source_odds: float
    target_odds: float
    odds_delta: float
    legs: list[LegResult]


class ErrorDetail(BaseModel):
    """Structured error information."""

    code: str
    message: str


class JobCreatedResponse(BaseModel):
    """Response for POST /v1/translate — immediate acknowledgment."""

    job_id: str
    status: str  # queued | completed (cache hit)
    result: TranslationResult | None = None


class JobStatusResponse(BaseModel):
    """Response for GET /v1/translate/{job_id} — current state."""

    job_id: str
    status: str  # queued | processing | completed | failed
    result: TranslationResult | None = None
    error: ErrorDetail | None = None


class HealthResponse(BaseModel):
    """Response for GET /health."""

    status: str = "ok"
    version: str
    services: dict[str, bool]
