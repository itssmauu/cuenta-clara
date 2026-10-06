"""add login lockout fields to users

Revision ID: 5bfc4f219686
Revises: ff539ddfe0f5
Create Date: 2026-10-05 20:24:55.823075

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5bfc4f219686"
down_revision: str | Sequence[str] | None = "ff539ddfe0f5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("failed_login_attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    # Autogenerate does not detect CHECK constraints on existing tables
    op.create_check_constraint(
        op.f("ck_users_failed_login_attempts_non_negative"),
        "users",
        "failed_login_attempts >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_users_failed_login_attempts_non_negative"), "users", type_="check")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")
