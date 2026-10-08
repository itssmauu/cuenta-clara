import uuid
from datetime import date
from decimal import Decimal
from typing import Literal

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


class CategorySpendingOut(BaseModel):
    category_id: uuid.UUID | None
    name: str
    color: str | None
    amount: Decimal


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
    # none · ok · warning (80 % or more of the limit used) · over
    limit_status: Literal["none", "ok", "warning", "over"]

    # Same totals for the previous period, to compare against
    previous_period_start: date
    previous_period_end: date
    previous_income: Decimal
    previous_spent: Decimal

    # Fixed + variable spending of the current period per category, largest first
    spending_by_category: list[CategorySpendingOut]

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
    # Which estimate was used for future periods: the average or a linear trend
    estimator: Literal["average", "trend"]
    # With the trend: how much variable spending changes per period, and how well the
    # line fits the history (R², 0 to 1)
    trend_per_period: Decimal | None
    trend_r_squared: Decimal | None
    history_points: int
    periods: list[ForecastPeriodOut]
