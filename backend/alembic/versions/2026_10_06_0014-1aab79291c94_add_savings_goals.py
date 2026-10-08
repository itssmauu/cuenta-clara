"""add savings goals

Revision ID: 1aab79291c94
Revises: 74c26cbc0c34
Create Date: 2026-10-06 00:14:56.065707

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1aab79291c94"
down_revision: str | Sequence[str] | None = "74c26cbc0c34"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "savings_goals",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("target_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "saved_amount", sa.Numeric(precision=12, scale=2), server_default="0", nullable=False
        ),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "saved_amount >= 0", name=op.f("ck_savings_goals_saved_amount_non_negative")
        ),
        sa.CheckConstraint(
            "target_amount > 0", name=op.f("ck_savings_goals_target_amount_positive")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_savings_goals_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_savings_goals")),
    )
    op.create_index(op.f("ix_savings_goals_user_id"), "savings_goals", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_savings_goals_user_id"), table_name="savings_goals")
    op.drop_table("savings_goals")
