import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.models import Frequency
from app.schemas.finance import TransactionOut


class SeriesPoint(BaseModel):
    period_start: date
    period_end: date
    spent: Decimal
    limit: Decimal | None
    over_limit: bool


class UpcomingFixedExpense(BaseModel):
    id: uuid.UUID
    name: str
    amount: Decimal
    due_on: date
    category_id: uuid.UUID | None


class DashboardOut(BaseModel):
    period: Frequency
    period_start: date
    period_end: date
    currency: str

    initial_balance: Decimal
    balance_as_of: date
    # Balance carried in from previous periods: available = opening + income − spent
    opening_balance: Decimal
    income: Decimal
    fixed_expenses: Decimal
    variable_expenses: Decimal
    spent: Decimal
    available_balance: Decimal

    # Spending limit converted to the selected period; null when the user has none
    spending_limit: Decimal | None
    limit_remaining: Decimal | None
    limit_used_percent: int | None
    over_limit: bool

    # Last 6 periods, oldest first, ending with the current one
    series: list[SeriesPoint]
    upcoming_fixed_expenses: list[UpcomingFixedExpense]
    recent_transactions: list[TransactionOut]


class ForecastPeriodOut(BaseModel):
    period_start: date
    period_end: date
    opening_balance: Decimal
    income: Decimal
    fixed_expenses: Decimal
    variable_spending: Decimal
    closing_balance: Decimal
    is_current: bool


class ForecastOut(BaseModel):
    period: Frequency
    currency: str
    # Mean variable spending per period, used for future periods
    average_variable_spending: Decimal
    periods: list[ForecastPeriodOut]
