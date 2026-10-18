"""add goal contributions

The history of what was put into (+) or taken out of (−) each savings goal, by day, so
the app can tell the user's saving pace. Contributions that moved money between accounts
were already recorded as transfers with goal_id: they seed the history.

Revision ID: 9a8b7c6d5e4f
Revises: 7c1d2e3f4a5b
Create Date: 2026-10-18 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9a8b7c6d5e4f"
down_revision: str | Sequence[str] | None = "7c1d2e3f4a5b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "goal_contributions",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("goal_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
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
        sa.CheckConstraint("amount <> 0", name=op.f("ck_goal_contributions_amount_not_zero")),
        sa.ForeignKeyConstraint(
            ["goal_id"],
            ["savings_goals.id"],
            name=op.f("fk_goal_contributions_goal_id_savings_goals"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_goal_contributions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goal_contributions")),
    )
    op.create_index(
        "ix_goal_contributions_goal_id_occurred_on",
        "goal_contributions",
        ["goal_id", "occurred_on"],
        unique=False,
    )
    op.create_index(
        op.f("ix_goal_contributions_user_id"), "goal_contributions", ["user_id"], unique=False
    )
    # Contributions that moved money: into the goal's account (+) or out of it (−)
    op.execute(
        """
        INSERT INTO goal_contributions (user_id, goal_id, amount, occurred_on)
        SELECT t.user_id,
               t.goal_id,
               CASE WHEN t.to_account_id = g.account_id THEN t.amount ELSE -t.amount END,
               t.occurred_on
        FROM transfers t
        JOIN savings_goals g ON g.id = t.goal_id
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_goal_contributions_user_id"), table_name="goal_contributions")
    op.drop_index("ix_goal_contributions_goal_id_occurred_on", table_name="goal_contributions")
    op.drop_table("goal_contributions")
