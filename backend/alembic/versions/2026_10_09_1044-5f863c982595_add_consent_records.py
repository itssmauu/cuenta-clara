"""add consent records

Proof of consent required by Ley 81: which version of the Terms and Privacy Policy each
user accepted and when, plus the separate opt-in for the AI assistant. Existing users
start without a record, so the app asks them to accept the current documents.

Revision ID: 5f863c982595
Revises: 411e0167ea8a
Create Date: 2026-10-09 10:44:53.178892

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5f863c982595"
down_revision: str | Sequence[str] | None = "411e0167ea8a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("assistant_consent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("users", sa.Column("terms_version", sa.String(length=20), nullable=True))
    op.add_column(
        "users", sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "terms_accepted_at")
    op.drop_column("users", "terms_version")
    op.drop_column("user_settings", "assistant_consent_at")
