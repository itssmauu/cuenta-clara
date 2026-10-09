import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, String, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, str_enum
from app.models.enums import Frequency


class UserSettings(IdMixin, TimestampMixin, Base):
    __tablename__ = "user_settings"
    __table_args__ = (
        CheckConstraint(
            "(income_period = 'custom') = (custom_period_days IS NOT NULL)",
            name="custom_period_days_iff_custom",
        ),
        CheckConstraint("custom_period_days >= 1", name="custom_period_days_positive"),
        CheckConstraint("spending_limit >= 0", name="spending_limit_non_negative"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    # The day the accounts' initial balances were true; nothing earlier counts
    balance_as_of: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    currency: Mapped[str] = mapped_column(String(3), server_default="USD")
    income_period: Mapped[Frequency] = mapped_column(
        str_enum(Frequency, "income_period"), server_default=Frequency.MONTHLY.value
    )
    custom_period_days: Mapped[int | None]
    spending_limit: Mapped[Decimal | None]
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, server_default=false())
    # Explicit opt-in to send a summary of the user's finances to the AI provider (Balbo).
    # None = not given (or withdrawn): the assistant stays off for this user
    assistant_consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
