import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, SmallInteger, String, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, str_enum
from app.models.enums import Frequency


class FixedExpense(IdMixin, TimestampMixin, Base):
    """A recurring expense (internet, phone data, bus fare, ...)."""

    __tablename__ = "fixed_expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint(
            "(frequency = 'custom') = (custom_period_days IS NOT NULL)",
            name="custom_period_days_iff_custom",
        ),
        CheckConstraint("custom_period_days >= 1", name="custom_period_days_positive"),
        CheckConstraint("due_day BETWEEN 1 AND 31", name="due_day_range"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    amount: Mapped[Decimal]
    frequency: Mapped[Frequency] = mapped_column(str_enum(Frequency, "fixed_expense_frequency"))
    custom_period_days: Mapped[int | None]
    # First day the expense applies; anchors weekly/biweekly/daily/custom repetitions
    start_date: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    # Day of the month the expense is due; only meaningful for monthly expenses
    due_day: Mapped[int | None] = mapped_column(SmallInteger)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())
