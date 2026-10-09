import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, true
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, str_enum
from app.models.enums import Frequency


class Income(IdMixin, TimestampMixin, Base):
    """A recurring income source (salary, allowance, ...)."""

    __tablename__ = "incomes"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint(
            "(frequency = 'custom') = (custom_period_days IS NOT NULL)",
            name="custom_period_days_iff_custom",
        ),
        CheckConstraint("custom_period_days >= 1", name="custom_period_days_positive"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(100))
    amount: Mapped[Decimal]
    frequency: Mapped[Frequency] = mapped_column(str_enum(Frequency, "income_frequency"))
    custom_period_days: Mapped[int | None]
    start_date: Mapped[date]
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())
    # The account the income arrives in
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), index=True)
