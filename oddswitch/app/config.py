"""
OddSwitch Engine — Configuration.

All settings loaded from environment variables with sensible defaults
for local development. Production values injected via Docker/env files.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings sourced from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Application ──────────────────────────────────────────────
    app_name: str = "OddSwitch Engine"
    app_version: str = "0.1.0"
    debug: bool = False

    # ── Database (PostgreSQL) ────────────────────────────────────
    database_url: str = "postgresql+asyncpg://oddswitch:oddswitch@localhost:5432/oddswitch"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_echo: bool = False

    # ── Redis ────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Celery ───────────────────────────────────────────────────
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # ── API Security ─────────────────────────────────────────────
    api_key_header: str = "X-API-Key"

    # ── Rate Limiting ────────────────────────────────────────────
    rate_limit_per_second: int = 10
    rate_limit_per_minute: int = 100

    # ── Cache TTLs (seconds) ─────────────────────────────────────
    cache_ttl_booking_code: int = 300        # 5 min  (live markets)
    cache_ttl_booking_code_prematch: int = 3600  # 1 hr (pre-match)
    cache_ttl_canonical_slip: int = 1800     # 30 min
    cache_ttl_translation: int = 900         # 15 min (live)
    cache_ttl_translation_prematch: int = 7200   # 2 hr (pre-match)
    cache_ttl_event_mapping: int = 1800      # 30 min
    cache_ttl_team_alias: int = 86400        # 24 hr
    cache_ttl_api_key: int = 300             # 5 min
    cache_ttl_dedup: int = 3600              # 1 hr
    cache_ttl_job_status: int = 300          # 5 min

    # ── Webhook ──────────────────────────────────────────────────
    webhook_max_retries: int = 3
    webhook_timeout_seconds: int = 10

    # ── Browser Pool ─────────────────────────────────────────────
    browser_pool_size: int = 3
    browser_context_max_uses: int = 20

    # ── Observability ────────────────────────────────────────────
    log_level: str = "INFO"
    log_format: str = "json"  # "json" or "console"


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
