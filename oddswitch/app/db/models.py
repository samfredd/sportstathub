"""
OddSwitch Engine — SQLAlchemy ORM Models.

All 6 tables that form the persistent state layer.
ULIDs used as primary keys for time-ordered, collision-resistant IDs.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from ulid import ULID


def _generate_ulid() -> str:
    """Generate a new ULID string."""
    return str(ULID())


def _utcnow() -> datetime:
    """Current UTC timestamp."""
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


# ── Translation Jobs ────────────────────────────────────────────────────────


class TranslationJob(Base):
    """
    Core job table. Tracks every translation request from intake to completion.

    Status lifecycle: queued → processing → completed | failed
    """

    __tablename__ = "translation_jobs"

    id: Mapped[str] = mapped_column(
        String(26), primary_key=True, default=_generate_ulid
    )
    source_bookmaker: Mapped[str] = mapped_column(String(50), nullable=False)
    target_bookmaker: Mapped[str] = mapped_column(String(50), nullable=False)
    booking_code: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    result_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    callback_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    api_key_id: Mapped[str] = mapped_column(String(26), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index(
            "ix_jobs_bookmaker_code",
            "source_bookmaker",
            "booking_code",
            "target_bookmaker",
        ),
        Index("ix_jobs_status", "status"),
        Index("ix_jobs_tenant_created", "api_key_id", "created_at"),
    )


# ── Canonical Slips ─────────────────────────────────────────────────────────


class CanonicalSlipRecord(Base):
    """
    Stores normalized, bookmaker-agnostic slip representations.
    Hash is the SHA-256 of the canonical JSON (odds-independent).
    """

    __tablename__ = "canonical_slips"

    id: Mapped[str] = mapped_column(
        String(26), primary_key=True, default=_generate_ulid
    )
    hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    normalized_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    source_bookmaker: Mapped[str] = mapped_column(String(50), nullable=False)
    source_code: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )


# ── Event Mappings ──────────────────────────────────────────────────────────


class EventMapping(Base):
    """
    Cross-bookmaker event identity mappings.
    Confidence score reflects how reliably we matched the event.
    """

    __tablename__ = "event_mappings"

    id: Mapped[str] = mapped_column(
        String(26), primary_key=True, default=_generate_ulid
    )
    source_event: Mapped[str] = mapped_column(String(200), nullable=False)
    target_event: Mapped[str] = mapped_column(String(200), nullable=False)
    source_bookmaker: Mapped[str] = mapped_column(String(50), nullable=False)
    target_bookmaker: Mapped[str] = mapped_column(String(50), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    last_verified: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    __table_args__ = (
        UniqueConstraint(
            "source_event",
            "source_bookmaker",
            "target_bookmaker",
            name="uq_event_mapping",
        ),
    )


# ── Market Mappings ─────────────────────────────────────────────────────────


class MarketMapping(Base):
    """
    Market type translation table.
    mapping_type classifies accuracy: exact, semantic, approximate.
    """

    __tablename__ = "market_mappings"

    id: Mapped[str] = mapped_column(
        String(26), primary_key=True, default=_generate_ulid
    )
    source_market: Mapped[str] = mapped_column(String(100), nullable=False)
    target_market: Mapped[str] = mapped_column(String(100), nullable=False)
    source_bookmaker: Mapped[str] = mapped_column(String(50), nullable=False)
    target_bookmaker: Mapped[str] = mapped_column(String(50), nullable=False)
    mapping_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="exact"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )


# ── Team Aliases ────────────────────────────────────────────────────────────


class TeamAlias(Base):
    """
    Team name normalization table.
    Maps bookmaker-specific names to a canonical name.
    bookmaker=NULL means the alias is universal.
    """

    __tablename__ = "team_aliases"

    id: Mapped[str] = mapped_column(
        String(26), primary_key=True, default=_generate_ulid
    )
    alias: Mapped[str] = mapped_column(String(200), nullable=False)
    canonical_name: Mapped[str] = mapped_column(String(200), nullable=False)
    bookmaker: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    __table_args__ = (
        UniqueConstraint("alias", "bookmaker", name="uq_team_alias"),
    )


# ── API Keys ────────────────────────────────────────────────────────────────


class ApiKey(Base):
    """
    API key store. Keys are hashed (SHA-256) on write.
    rate_limit_override allows per-key throttle tuning.
    """

    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(
        String(26), primary_key=True, default=_generate_ulid
    )
    key_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    rate_limit_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
