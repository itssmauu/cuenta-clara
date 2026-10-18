import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


class SavingsGoal(IdMixin, TimestampMixin, Base):
    """Money the user wants to put aside for something ("Laptop", "Fondo de emergencia")."""

    __tablename__ = "savings_goals"
    __table_args__ = (
        CheckConstraint("target_amount > 0", name="target_amount_positive"),
        CheckConstraint("saved_amount >= 0", name="saved_amount_non_negative"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    target_amount: Mapped[Decimal]
    saved_amount: Mapped[Decimal] = mapped_column(server_default="0")
    due_date: Mapped[date | None]
    # Where the money for this goal is kept (contributions move money into it)
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id"), index=True)


class GoalContribution(IdMixin, TimestampMixin, Base):
    """Money put into (+) or taken out of (−) a goal on a given day.

    The goal keeps the running total in `saved_amount`; these rows keep the history, so
    the app can tell the user's saving pace and project how much they will have.
    """

    __tablename__ = "goal_contributions"
    __table_args__ = (
        CheckConstraint("amount <> 0", name="amount_not_zero"),
        Index("ix_goal_contributions_goal_id_occurred_on", "goal_id", "occurred_on"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("savings_goals.id", ondelete="CASCADE"))
    amount: Mapped[Decimal]
    occurred_on: Mapped[date]
