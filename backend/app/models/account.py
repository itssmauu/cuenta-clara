import uuid
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Index, String, UniqueConstraint, false, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, str_enum
from app.models.enums import AccountKind


class Account(IdMixin, TimestampMixin, Base):
    """One of the user's bank accounts, wallets or funds, known only by a name they choose.

    Deliberately no account number, bank, card or password: the app needs to tell the
    accounts apart, not to reach them. The primary account is the day-to-day one: the
    dashboard opens on it and the spending limit applies to it.
    """

    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_accounts_user_id_name"),
        # Exactly one primary account per user (registration creates it)
        Index(
            "uq_accounts_one_primary_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_primary"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(50))
    kind: Mapped[AccountKind] = mapped_column(str_enum(AccountKind, "account_kind"))
    # What the account held on the user's balance_as_of day
    initial_balance: Mapped[Decimal] = mapped_column(server_default="0")
    is_primary: Mapped[bool] = mapped_column(Boolean, server_default=false())
