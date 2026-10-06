"""add balance and start dates

Revision ID: 74c26cbc0c34
Revises: 5bfc4f219686
Create Date: 2026-10-05 20:49:51.865122

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "74c26cbc0c34"
down_revision: str | Sequence[str] | None = "5bfc4f219686"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "fixed_expenses",
        sa.Column("start_date", sa.Date(), server_default=sa.text("CURRENT_DATE"), nullable=False),
    )
    op.add_column(
        "user_settings",
        sa.Column(
            "balance_as_of", sa.Date(), server_default=sa.text("CURRENT_DATE"), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "balance_as_of")
    op.drop_column("fixed_expenses", "start_date")
