"""
OddSwitch Engine — Structured Logging.

JSON-formatted structured logging via structlog.
Request ID correlation for distributed tracing.
"""

import logging
import sys

import structlog

from app.config import get_settings


def setup_logging() -> None:
    """Configure structured logging for the application."""
    settings = get_settings()

    # Determine processors based on format
    if settings.log_format == "json":
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.log_level)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Also configure stdlib logging for third-party libs
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.log_level, logging.INFO),
    )
