"""Tenant ownership and callback security.

Revision ID: 002
Revises: 001
"""
from typing import Sequence, Union
import hashlib
import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LEGACY_TENANT_ID = "00000000000000000000000000"


def upgrade() -> None:
    # Existing unowned rows are assigned to an inactive, unusable legacy tenant
    # so the constraint can be introduced without deleting production history.
    op.execute(sa.text(
        "INSERT INTO api_keys (id,key_hash,name,is_active) VALUES "
        "(:id,:hash,'legacy-unowned',false) ON CONFLICT (id) DO NOTHING"
    ).bindparams(id=LEGACY_TENANT_ID, hash=hashlib.sha256(b"unusable-legacy-tenant").hexdigest()))
    op.execute(sa.text("UPDATE translation_jobs SET api_key_id = :id WHERE api_key_id IS NULL").bindparams(id=LEGACY_TENANT_ID))
    op.alter_column("translation_jobs", "api_key_id", nullable=False)
    op.create_foreign_key("fk_translation_jobs_api_key", "translation_jobs", "api_keys", ["api_key_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_jobs_tenant_created", "translation_jobs", ["api_key_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_jobs_tenant_created", table_name="translation_jobs")
    op.drop_constraint("fk_translation_jobs_api_key", "translation_jobs", type_="foreignkey")
    op.alter_column("translation_jobs", "api_key_id", nullable=True)
