"""Balance, spending-limit and forecast math. Pure: plain data in, plain data out.

The model, in one sentence: the user had `initial_balance` on `balance_as_of`; from that
day on, recurring incomes and one-off income transactions add money, while fixed expenses
and one-off expense transactions take it away. Nothing dated earlier counts.

    balance at the end of a period = opening balance + income − fixed expenses − variable spending

Example (weekly): starts with $100, spends $30, receives $160 → $100 − $30 + $160 = $230.
"""

import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from app.models import Frequency
from app.services.periods import Cadence, Period, recurring_dates

ZERO = Decimal("0.00")
CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


# ── Inputs ──────────────────────────────────────────────


@dataclass(frozen=True)
class Recurring:
    """A recurring income or fixed expense."""

    amount: Decimal
    frequency: Frequency
    start: date
    custom_days: int | None = None
    day_of_month: int | None = None
    id: uuid.UUID | None = None
    name: str = ""
    category_id: uuid.UUID | None = None

    def dates_in(self, window: Period) -> list[date]:
        return recurring_dates(
            self.frequency,
            self.start,
            window,
            custom_days=self.custom_days,
            day_of_month=self.day_of_month,
        )

    def total_in(self, window: Period) -> Decimal:
        return self.amount * len(self.dates_in(window))


@dataclass(frozen=True)
class OneOff:
    """A single income or expense transaction."""

    on: date
    amount: Decimal
    is_income: bool


@dataclass(frozen=True)
class FinanceData:
    initial_balance: Decimal
    balance_as_of: date
    # Spending limit per `limit_cadence` (the user's income period); None = no limit
    spending_limit: Decimal | None
    limit_cadence: Cadence
    incomes: list[Recurring] = field(default_factory=list)
    fixed_expenses: list[Recurring] = field(default_factory=list)
    transactions: list[OneOff] = field(default_factory=list)


# ── Aggregates ──────────────────────────────────────────


@dataclass(frozen=True)
class Totals:
    income: Decimal = ZERO
    fixed_expenses: Decimal = ZERO
    variable_expenses: Decimal = ZERO

    @property
    def spent(self) -> Decimal:
        return self.fixed_expenses + self.variable_expenses

    @property
    def net(self) -> Decimal:
        return self.income - self.spent


def totals(data: FinanceData, window: Period) -> Totals:
    """Money in and out during `window`, ignoring anything before `balance_as_of`."""
    tracked = window.clip_start(data.balance_as_of)
    if tracked is None:
        return Totals()

    one_offs = [t for t in data.transactions if t.on in tracked]
    income = sum((i.total_in(tracked) for i in data.incomes), ZERO) + sum(
        (t.amount for t in one_offs if t.is_income), ZERO
    )
    fixed = sum((f.total_in(tracked) for f in data.fixed_expenses), ZERO)
    variable = sum((t.amount for t in one_offs if not t.is_income), ZERO)
    return Totals(money(income), money(fixed), money(variable))


def balance_at_end_of(data: FinanceData, day: date) -> Decimal:
    """Balance after everything that happened up to and including `day`."""
    if day < data.balance_as_of:
        return money(data.initial_balance)
    return money(data.initial_balance + totals(data, Period(data.balance_as_of, day)).net)


def limit_for(data: FinanceData, cadence: Cadence) -> Decimal | None:
    """The spending limit converted to another period length (e.g. monthly → weekly)."""
    if data.spending_limit is None:
        return None
    if cadence == data.limit_cadence:
        return money(data.spending_limit)
    return money(data.spending_limit * cadence.average_days / data.limit_cadence.average_days)


# ── Dashboard ───────────────────────────────────────────


@dataclass(frozen=True)
class PeriodSpending:
    period: Period
    spent: Decimal
    limit: Decimal | None

    @property
    def over_limit(self) -> bool:
        return self.limit is not None and self.spent > self.limit


@dataclass(frozen=True)
class UpcomingExpense:
    expense: Recurring
    due_on: date


@dataclass(frozen=True)
class Dashboard:
    period: Period
    opening_balance: Decimal
    totals: Totals
    available_balance: Decimal
    limit: Decimal | None
    series: list[PeriodSpending]
    upcoming: list[UpcomingExpense]

    @property
    def limit_remaining(self) -> Decimal | None:
        return None if self.limit is None else self.limit - self.totals.spent

    @property
    def over_limit(self) -> bool:
        return self.limit is not None and self.totals.spent > self.limit

    @property
    def limit_used_percent(self) -> int | None:
        if self.limit is None or self.limit == 0:
            return None
        percent = self.totals.spent * 100 / self.limit
        return int(percent.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def build_dashboard(
    data: FinanceData,
    cadence: Cadence,
    today: date,
    *,
    history: int = 6,
    upcoming_limit: int = 5,
) -> Dashboard:
    current = cadence.containing(today)
    current_totals = totals(data, current)
    opening = balance_at_end_of(data, current.start - timedelta(days=1))
    limit = limit_for(data, cadence)

    # Oldest → newest, ending with the current period
    periods = [current]
    while len(periods) < history:
        periods.insert(0, cadence.previous(periods[0]))
    series = [PeriodSpending(p, totals(data, p).spent, limit) for p in periods]

    return Dashboard(
        period=current,
        opening_balance=opening,
        totals=current_totals,
        available_balance=money(opening + current_totals.net),
        limit=limit,
        series=series,
        upcoming=next_fixed_expenses(data, today, upcoming_limit),
    )


def next_fixed_expenses(data: FinanceData, today: date, limit: int) -> list[UpcomingExpense]:
    """The next due date of each fixed expense, soonest first."""
    horizon = Period(today, today + timedelta(days=400))
    upcoming = []
    for expense in data.fixed_expenses:
        dates = expense.dates_in(horizon)
        if dates:
            upcoming.append(UpcomingExpense(expense, dates[0]))
    upcoming.sort(key=lambda u: (u.due_on, u.expense.name))
    return upcoming[:limit]


# ── Forecast ────────────────────────────────────────────


@dataclass(frozen=True)
class ForecastPeriod:
    period: Period
    opening_balance: Decimal
    income: Decimal
    fixed_expenses: Decimal
    # Real spending so far for the current period; the historical average for future ones
    variable_spending: Decimal
    is_current: bool

    @property
    def closing_balance(self) -> Decimal:
        return money(
            self.opening_balance + self.income - self.fixed_expenses - self.variable_spending
        )


def average_variable_spending(
    data: FinanceData, cadence: Cadence, current: Period, *, max_periods: int = 6
) -> Decimal:
    """Mean variable spending over the last fully tracked periods.

    Without any complete period yet (a brand-new user), the current period's spending
    so far is the best estimate available.
    """
    samples: list[Decimal] = []
    period = cadence.previous(current)
    while len(samples) < max_periods and period.start >= data.balance_as_of:
        samples.append(totals(data, period).variable_expenses)
        period = cadence.previous(period)
    if not samples:
        return totals(data, current).variable_expenses
    return money(sum(samples, ZERO) / len(samples))


def build_forecast(
    data: FinanceData, cadence: Cadence, today: date, periods: int
) -> tuple[Decimal, list[ForecastPeriod]]:
    """Projected balance for `periods` periods, starting with the current one."""
    current = cadence.containing(today)
    average = average_variable_spending(data, cadence, current)

    forecast: list[ForecastPeriod] = []
    period = current
    opening = balance_at_end_of(data, current.start - timedelta(days=1))
    for index in range(periods):
        period_totals = totals(data, period)
        is_current = index == 0
        row = ForecastPeriod(
            period=period,
            opening_balance=opening,
            income=period_totals.income,
            fixed_expenses=period_totals.fixed_expenses,
            variable_spending=period_totals.variable_expenses if is_current else average,
            is_current=is_current,
        )
        forecast.append(row)
        opening = row.closing_balance
        period = cadence.next(period)
    return average, forecast
