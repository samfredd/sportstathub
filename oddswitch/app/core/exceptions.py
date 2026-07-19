"""
OddSwitch Engine — Custom Exceptions & Error Handlers.

Structured error responses for all failure modes.
Each exception maps to a specific HTTP status code.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

# ── Exception Classes ────────────────────────────────────────────────────────


class OddSwitchError(Exception):
    """Base exception for all OddSwitch errors."""

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

    def __init__(self, message: str = "An internal error occurred") -> None:
        self.message = message
        super().__init__(self.message)


class BookmakerNotSupported(OddSwitchError):
    """Raised when a requested bookmaker is not supported."""

    status_code = 400
    error_code = "BOOKMAKER_NOT_SUPPORTED"

    def __init__(self, bookmaker: str) -> None:
        super().__init__(f"Bookmaker '{bookmaker}' is not supported")


class InvalidBookingCode(OddSwitchError):
    """Raised when a booking code is malformed or empty."""

    status_code = 400
    error_code = "INVALID_BOOKING_CODE"

    def __init__(self, code: str) -> None:
        super().__init__(f"Invalid booking code: '{code}'")


class JobNotFound(OddSwitchError):
    """Raised when a job_id does not exist."""

    status_code = 404
    error_code = "JOB_NOT_FOUND"

    def __init__(self, job_id: str) -> None:
        super().__init__(f"Job '{job_id}' not found")


class TranslationFailed(OddSwitchError):
    """Raised when the translation pipeline fails."""

    status_code = 500
    error_code = "TRANSLATION_FAILED"


class UnsupportedMarket(OddSwitchError):
    """Raised when a market type cannot be translated."""

    status_code = 422
    error_code = "UNSUPPORTED_MARKET"

    def __init__(self, market: str) -> None:
        super().__init__(f"Market '{market}' is not supported for translation")


class RateLimitExceeded(OddSwitchError):
    """Raised when the client exceeds rate limits."""

    status_code = 429
    error_code = "RATE_LIMIT_EXCEEDED"

    def __init__(self) -> None:
        super().__init__("Rate limit exceeded. Try again later.")


class AuthenticationError(OddSwitchError):
    """Raised when API key is missing or invalid."""

    status_code = 401
    error_code = "AUTHENTICATION_FAILED"

    def __init__(self) -> None:
        super().__init__("Invalid or missing API key")


# ── Supported Bookmakers ─────────────────────────────────────────────────────

SUPPORTED_BOOKMAKERS = {"sportybet", "bet9ja"}


# ── Error Handlers ───────────────────────────────────────────────────────────


def register_exception_handlers(app: FastAPI) -> None:
    """Register all custom exception handlers on the FastAPI app."""

    @app.exception_handler(OddSwitchError)
    async def oddswitch_error_handler(
        request: Request, exc: OddSwitchError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.error_code,
                    "message": exc.message,
                }
            },
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                }
            },
        )
