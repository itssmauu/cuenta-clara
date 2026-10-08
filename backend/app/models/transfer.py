import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


class Transfer(IdMixin, TimestampMixin, Base):
    """Money moved between two of the user's accounts: neither income nor spending."""

    __tablename__ = "transfers"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint("from_account_id <> to_account_id", name="different_accounts"),
        Index("ix_transfers_user_id_occurred_on", "user_id", "occurred_on"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    from_account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), index=True)
    to_account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), index=True)
    amount: Mapped[Decimal]
    occurred_on: Mapped[date]
    note: Mapped[str | None] = mapped_column(String(255))
    # Set when the move was a contribution to (or withdrawal from) a savings goal
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("savings_goals.id", ondelete="SET NULL"), index=True
    )
