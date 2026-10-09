"""Balance, spending-limit and forecast math. Pure: plain data in, plain data out.

The model, in one sentence: the user had `initial_balance` on `balance_as_of`; from that
day on, recurring incomes and one-off income transactions add money, while fixed expenses
and one-off expense transactions take it away. Nothing dated earlier counts.

    balance at the end of a period = opening balance + income − fixed expenses − variable spending
                                     + transfers in − transfers out

The data is always scoped to some of the user's accounts (one account, or all of them):
`initial_balance` is the sum of those accounts' balances and only their movements count.
Money moved between two accounts in the scope cancels out; money moved in or out of the
scope is a transfer, which changes the balance but is neither income nor spending.

Example (weekly): starts with $100, spends $30, receives $160 → $100 − $30 + $160 = $230.
"""

import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from app.models import Frequency
from app.services.periods import Cadence, Period, recurring_dates
from app.services.trend import MIN_POINTS, fit_line

ZERO = Decimal("0.00")
# Warn the user once they have used this share of the period's spending limit
WARNING_PERCENT = 80
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
    category_id: uuid.UUID | None = None


@dataclass(frozen=True)
class Move:
    """A transfer seen from the scope: positive when money comes in, negative when it leaves."""

    on: date
    amount: Decimal


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
    moves: list[Move] = field(default_factory=list)


# ── Aggregates ──────────────────────────────────────────


@dataclass(frozen=True)
class Totals:
    income: Decimal = ZERO
    fixed_expenses: Decimal = ZERO
    variable_expenses: Decimal = ZERO
    # Net money moved in (+) or out (−) of the scope's accounts; not income, not spending
    transfers: Decimal = ZERO

    @property
    def spent(self) -> Decimal:
        return self.fixed_expenses + self.variable_expenses

    @property
    def net(self) -> Decimal:
        return self.income - self.spent + self.transfers


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
    transfers = sum((m.amount for m in data.moves if m.on in tracked), ZERO)
    return Totals(money(income), money(fixed), money(variable), money(transfers))


@dataclass(frozen=True)
class CategorySpending:
    category_id: uuid.UUID | None  # None = uncategorized
    amount: Decimal


def spending_by_category(data: FinanceData, window: Period) -> list[CategorySpending]:
    """Fixed and variable spending in `window`, grouped by category, largest first."""
    tracked = window.clip_start(data.balance_as_of)
    if tracked is None:
        return []
    amounts: dict[uuid.UUID | None, Decimal] = {}
    for expense in data.fixed_expenses:
        spent = expense.total_in(tracked)
        if spent:
            amounts[expense.category_id] = amounts.get(expense.category_id, ZERO) + spent
    for t in data.transactions:
        if not t.is_income and t.on in tracked:
            amounts[t.category_id] = amounts.get(t.category_id, ZERO) + t.amount
    result = [CategorySpending(cid, money(amount)) for cid, amount in amounts.items()]
    # Largest first; on a tie, named categories before "uncategorized"
    return sorted(result, key=lambda c: (-c.amount, c.category_id is None))


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
    previous_period: Period
    previous_totals: Totals
    by_category: list[CategorySpending]

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

    @property
    def limit_status(self) -> str:
        """none (no limit) · ok · warning (80 % or more used) · over (went past it)."""
        percent = self.limit_used_percent
        if self.limit is None or percent is None:
            return "none"
        if self.over_limit:
            return "over"
        return "warning" if percent >= WARNING_PERCENT else "ok"


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
    previous = cadence.previous(current)

    return Dashboard(
        period=current,
        opening_balance=opening,
        totals=current_totals,
        available_balance=money(opening + current_totals.net),
        limit=limit,
        series=series,
        upcoming=next_fixed_expenses(data, today, upcoming_limit),
        previous_period=previous,
        previous_totals=totals(data, previous),
        by_category=spending_by_category(data, current),
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
    # Transfers already recorded for the period (future ones are never guessed)
    transfers: Decimal = ZERO

    @property
    def closing_balance(self) -> Decimal:
        return money(
            self.opening_balance
            + self.income
            - self.fixed_expenses
            - self.variable_spending
            + self.transfers
        )


def variable_spending_history(
    data: FinanceData, cadence: Cadence, current: Period, *, max_periods: int
) -> list[Decimal]:
    """Variable spending of the last fully tracked periods, oldest first."""
    samples: list[Decimal] = []
    period = cadence.previous(current)
    while len(samples) < max_periods and period.start >= data.balance_as_of:
        samples.insert(0, totals(data, period).variable_expenses)
        period = cadence.previous(period)
    return samples


def average_variable_spending(
    data: FinanceData, cadence: Cadence, current: Period, *, max_periods: int = 6
) -> Decimal:
    """Mean variable spending over the last fully tracked periods.

    Without any complete period yet (a brand-new user), the current period's spending
    so far is the best estimate available.
    """
    samples = variable_spending_history(data, cadence, current, max_periods=max_periods)
    if not samples:
        return totals(data, current).variable_expenses
    return money(sum(samples, ZERO) / len(samples))


@dataclass(frozen=True)
class Forecast:
    periods: list[ForecastPeriod]
    average: Decimal
    # "average" or "trend"; trend falls back to average with too little history
    estimator: str
    # Change in variable spending per period found by the regression (trend only)
    trend_per_period: Decimal | None = None
    trend_r_squared: Decimal | None = None
    history_points: int = 0


TREND_HISTORY = 8


def build_forecast(
    data: FinanceData, cadence: Cadence, today: date, periods: int, *, estimator: str = "average"
) -> Forecast:
    """Projected balance for `periods` periods, starting with the current one.

    Future variable spending is either the recent average or, with estimator="trend",
    a least-squares line fitted to the last periods (see trend.py), never below zero.
    """
    current = cadence.containing(today)
    average = average_variable_spending(data, cadence, current)
    history = variable_spending_history(data, cadence, current, max_periods=TREND_HISTORY)
    fit = fit_line(history) if estimator == "trend" and len(history) >= MIN_POINTS else None

    def estimate(index: int) -> Decimal:
        if fit is None:
            return average
        # The history covers x = 0 … n-1, so the current period is x = n
        return money(max(fit.predict(len(history) + index), ZERO))

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
            variable_spending=period_totals.variable_expenses if is_current else estimate(index),
            is_current=is_current,
            transfers=period_totals.transfers,
        )
        forecast.append(row)
        opening = row.closing_balance
        period = cadence.next(period)
    return Forecast(
        periods=forecast,
        average=average,
        estimator="trend" if fit else "average",
        trend_per_period=money(fit.slope) if fit else None,
        trend_r_squared=fit.r_squared.quantize(CENT) if fit else None,
        history_points=len(history),
    )
