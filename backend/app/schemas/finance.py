"""Request/response models for settings, categories, incomes, fixed expenses and transactions."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Self

from pydantic import Field, StringConstraints, computed_field, model_validator

from app.models import Frequency, TransactionType
from app.schemas.common import (
    CustomPeriodDays,
    FrequencyFields,
    HexColor,
    InputModel,
    Label,
    NonNegativeMoney,
    Note,
    OutputModel,
    PositiveMoney,
    ShortText,
)

# ── Settings ────────────────────────────────────────────


class SettingsIn(InputModel):
    initial_balance: NonNegativeMoney
    # The day initial_balance was true (the client sends its local date)
    balance_as_of: date
    currency: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")] = "USD"
    income_period: Frequency
    custom_period_days: CustomPeriodDays | None = None
    spending_limit: NonNegativeMoney | None = None
    onboarding_completed: bool = False

    @model_validator(mode="after")
    def _custom_period_days_iff_custom(self) -> Self:
        if (self.income_period == Frequency.CUSTOM) != (self.custom_period_days is not None):
            raise ValueError("Indica los días solo cuando el periodo de ingreso es personalizado.")
        return self


class SettingsOut(OutputModel):
    initial_balance: Decimal
    balance_as_of: date
    currency: str
    income_period: Frequency
    custom_period_days: int | None
    spending_limit: Decimal | None
    onboarding_completed: bool


# ── Categories ──────────────────────────────────────────


class CategoryIn(InputModel):
    name: ShortText
    color: HexColor


class CategoryOut(OutputModel):
    id: uuid.UUID
    name: str
    color: str
    user_id: uuid.UUID | None = Field(exclude=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_default(self) -> bool:
        return self.user_id is None


# ── Incomes ─────────────────────────────────────────────


class IncomeIn(FrequencyFields):
    label: Label
    amount: PositiveMoney
    start_date: date
    is_active: bool = True


class IncomeOut(OutputModel):
    id: uuid.UUID
    label: str
    amount: Decimal
    frequency: Frequency
    custom_period_days: int | None
    start_date: date
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ── Fixed expenses ──────────────────────────────────────


class FixedExpenseIn(FrequencyFields):
    name: Label
    amount: PositiveMoney
    start_date: date
    due_day: Annotated[int, Field(ge=1, le=31)] | None = None
    category_id: uuid.UUID | None = None
    is_active: bool = True


class FixedExpenseOut(OutputModel):
    id: uuid.UUID
    name: str
    amount: Decimal
    frequency: Frequency
    custom_period_days: int | None
    start_date: date
    due_day: int | None
    category_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ── Transactions ────────────────────────────────────────


class TransactionIn(InputModel):
    type: TransactionType
    amount: PositiveMoney
    category_id: uuid.UUID | None = None
    occurred_on: date
    note: Note | None = None


class TransactionOut(OutputModel):
    id: uuid.UUID
    type: TransactionType
    amount: Decimal
    category_id: uuid.UUID | None
    occurred_on: date
    note: str | None
    created_at: datetime
    updated_at: datetime


class TransactionPage(OutputModel):
    items: list[TransactionOut]
    total: int
    limit: int
    offset: int
