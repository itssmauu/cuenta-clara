import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, str_enum
from app.models.enums import TransactionType


class Transaction(IdMixin, TimestampMixin, Base):
    """A one-off movement of money. `amount` is always positive; `type` gives the sign."""

    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        # Dashboard queries filter by user and date range
        Index("ix_transactions_user_id_occurred_on", "user_id", "occurred_on"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[TransactionType] = mapped_column(str_enum(TransactionType, "transaction_type"))
    amount: Mapped[Decimal]
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )
    occurred_on: Mapped[date]
    note: Mapped[str | None] = mapped_column(String(255))
