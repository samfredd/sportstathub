"""Initial schema — all 6 tables.

Revision ID: 001
Revises: None
Create Date: 2026-04-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── api_keys ─────────────────────────────────────────────
    op.create_table(
        "api_keys",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("key_hash", sa.String(128), unique=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("rate_limit_override", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── translation_jobs ─────────────────────────────────────
    op.create_table(
        "translation_jobs",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("source_bookmaker", sa.String(50), nullable=False),
        sa.Column("target_bookmaker", sa.String(50), nullable=False),
        sa.Column("booking_code", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("result_json", JSONB, nullable=True),
        sa.Column("error_code", sa.String(50), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("callback_url", sa.String(500), nullable=True),
        sa.Column("api_key_id", sa.String(26), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_jobs_bookmaker_code",
        "translation_jobs",
        ["source_bookmaker", "booking_code", "target_bookmaker"],
    )
    op.create_index("ix_jobs_status", "translation_jobs", ["status"])

    # ── canonical_slips ──────────────────────────────────────
    op.create_table(
        "canonical_slips",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("hash", sa.String(64), unique=True, nullable=False),
        sa.Column("normalized_json", JSONB, nullable=False),
        sa.Column("source_bookmaker", sa.String(50), nullable=False),
        sa.Column("source_code", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── event_mappings ───────────────────────────────────────
    op.create_table(
        "event_mappings",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("source_event", sa.String(200), nullable=False),
        sa.Column("target_event", sa.String(200), nullable=False),
        sa.Column("source_bookmaker", sa.String(50), nullable=False),
        sa.Column("target_bookmaker", sa.String(50), nullable=False),
        sa.Column("confidence", sa.Float, nullable=False, server_default=sa.text("1.0")),
        sa.Column("last_verified", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "source_event",
            "source_bookmaker",
            "target_bookmaker",
            name="uq_event_mapping",
        ),
    )

    # ── market_mappings ──────────────────────────────────────
    op.create_table(
        "market_mappings",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("source_market", sa.String(100), nullable=False),
        sa.Column("target_market", sa.String(100), nullable=False),
        sa.Column("source_bookmaker", sa.String(50), nullable=False),
        sa.Column("target_bookmaker", sa.String(50), nullable=False),
        sa.Column(
            "mapping_type", sa.String(20), nullable=False, server_default="exact"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ── team_aliases ─────────────────────────────────────────
    op.create_table(
        "team_aliases",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("alias", sa.String(200), nullable=False),
        sa.Column("canonical_name", sa.String(200), nullable=False),
        sa.Column("bookmaker", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("alias", "bookmaker", name="uq_team_alias"),
    )


def downgrade() -> None:
    op.drop_table("team_aliases")
    op.drop_table("market_mappings")
    op.drop_table("event_mappings")
    op.drop_table("canonical_slips")
    op.drop_table("translation_jobs")
    op.drop_table("api_keys")
