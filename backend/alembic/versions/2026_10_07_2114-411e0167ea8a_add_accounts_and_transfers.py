"""add accounts and transfers

Each existing user gets one primary, day-to-day account ("Cuenta principal") holding the
balance their settings had, and every income, fixed expense, transaction and savings goal
is assigned to it. The balance then lives on the accounts, not in user_settings.

Revision ID: 411e0167ea8a
Revises: 1aab79291c94
Create Date: 2026-10-07 21:14:58.731099

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "411e0167ea8a"
down_revision: str | Sequence[str] | None = "1aab79291c94"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "spending",
                "savings",
                "investment",
                "other",
                name="account_kind",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column(
            "initial_balance", sa.Numeric(precision=12, scale=2), server_default="0", nullable=False
        ),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.text("false"), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_accounts_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_accounts")),
        sa.UniqueConstraint("user_id", "name", name="uq_accounts_user_id_name"),
    )
    op.create_index(op.f("ix_accounts_user_id"), "accounts", ["user_id"], unique=False)
    op.create_index(
        "uq_accounts_one_primary_per_user",
        "accounts",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_primary"),
    )
    op.create_table(
        "transfers",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("from_account_id", sa.Uuid(), nullable=False),
        sa.Column("to_account_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column("goal_id", sa.Uuid(), nullable=True),
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
        sa.CheckConstraint("amount > 0", name=op.f("ck_transfers_amount_positive")),
        sa.CheckConstraint(
            "from_account_id <> to_account_id", name=op.f("ck_transfers_different_accounts")
        ),
        sa.ForeignKeyConstraint(
            ["from_account_id"], ["accounts.id"], name=op.f("fk_transfers_from_account_id_accounts")
        ),
        sa.ForeignKeyConstraint(
            ["goal_id"],
            ["savings_goals.id"],
            name=op.f("fk_transfers_goal_id_savings_goals"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["to_account_id"], ["accounts.id"], name=op.f("fk_transfers_to_account_id_accounts")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_transfers_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_transfers")),
    )
    op.create_index(
        op.f("ix_transfers_from_account_id"), "transfers", ["from_account_id"], unique=False
    )
    op.create_index(op.f("ix_transfers_goal_id"), "transfers", ["goal_id"], unique=False)
    op.create_index(
        op.f("ix_transfers_to_account_id"), "transfers", ["to_account_id"], unique=False
    )
    op.create_index(
        "ix_transfers_user_id_occurred_on", "transfers", ["user_id", "occurred_on"], unique=False
    )
    # Backfill: one primary account per user, with the balance the settings held
    op.execute(
        """
        INSERT INTO accounts (user_id, name, kind, initial_balance, is_primary)
        SELECT u.id, 'Cuenta principal', 'spending', COALESCE(s.initial_balance, 0), true
        FROM users u LEFT JOIN user_settings s ON s.user_id = u.id
        """
    )
    accounts = sa.table(
        "accounts",
        sa.column("id", sa.Uuid()),
        sa.column("user_id", sa.Uuid()),
        sa.column("is_primary", sa.Boolean()),
    )
    for table in ("fixed_expenses", "incomes", "savings_goals", "transactions"):
        op.add_column(table, sa.Column("account_id", sa.Uuid(), nullable=True))
        # Point every row at its owner's primary account (built with Core: no SQL strings)
        rows = sa.table(table, sa.column("user_id", sa.Uuid()), sa.column("account_id", sa.Uuid()))
        primary = (
            sa.select(accounts.c.id)
            .where(accounts.c.user_id == rows.c.user_id, accounts.c.is_primary)
            .scalar_subquery()
        )
        op.execute(rows.update().values(account_id=primary))
        # Goals may stay unlinked; money movements always belong to an account
        if table != "savings_goals":
            op.alter_column(table, "account_id", nullable=False)
        op.create_index(op.f(f"ix_{table}_account_id"), table, ["account_id"], unique=False)
        op.create_foreign_key(
            op.f(f"fk_{table}_account_id_accounts"), table, "accounts", ["account_id"], ["id"]
        )
    op.drop_column("user_settings", "initial_balance")


def downgrade() -> None:
    # One balance per user again: the primary account's. Other accounts and transfers
    # cannot be represented in the old schema and are dropped.
    op.add_column(
        "user_settings",
        sa.Column(
            "initial_balance",
            sa.NUMERIC(precision=12, scale=2),
            server_default=sa.text("'0'::numeric"),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.execute(
        """
        UPDATE user_settings AS s SET initial_balance = a.initial_balance
        FROM accounts AS a WHERE a.user_id = s.user_id AND a.is_primary
        """
    )
    for table in ("transactions", "savings_goals", "incomes", "fixed_expenses"):
        op.drop_constraint(op.f(f"fk_{table}_account_id_accounts"), table, type_="foreignkey")
        op.drop_index(op.f(f"ix_{table}_account_id"), table_name=table)
        op.drop_column(table, "account_id")
    op.drop_index("ix_transfers_user_id_occurred_on", table_name="transfers")
    op.drop_index(op.f("ix_transfers_to_account_id"), table_name="transfers")
    op.drop_index(op.f("ix_transfers_goal_id"), table_name="transfers")
    op.drop_index(op.f("ix_transfers_from_account_id"), table_name="transfers")
    op.drop_table("transfers")
    op.drop_index(
        "uq_accounts_one_primary_per_user",
        table_name="accounts",
        postgresql_where=sa.text("is_primary"),
    )
    op.drop_index(op.f("ix_accounts_user_id"), table_name="accounts")
    op.drop_table("accounts")
