"""add third_party to transactions

Marks one-off movements of someone else's money: received to pay something for them, or
paid on their behalf. They change the account's balance but are neither income nor
spending. Every existing movement is the user's own (false).

Revision ID: 7c1d2e3f4a5b
Revises: fe27722482af
Create Date: 2026-10-15 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7c1d2e3f4a5b"
down_revision: str | Sequence[str] | None = "fe27722482af"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("third_party", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("transactions", "third_party")
