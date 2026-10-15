"""Budgets per category: how much the user wants to spend on each one, and how it goes.

Pure functions, like projections.py: plain data in, plain data out, no database or clock.

- A budget is stored per the user's income period and converted to the period shown by
  average length (`convert_amount`, the same rule as the spending limit).
- What counts as spent on a category is exactly the dashboard's breakdown
  (`spending_by_category`): fixed expenses plus variable spending in the period, no
  income, no transfers, nothing before `balance_as_of`, within the account scope.
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from app.services.periods import Cadence, Period
from app.services.projections import (
    WARNING_PERCENT,
    ZERO,
    CategorySpending,
    FinanceData,
    complete_periods,
    convert_amount,
    money,
    spending_by_category,
)

BudgetStatus = Literal["none", "ok", "warning", "over"]
HUNDREDTH = Decimal("0.01")
SUGGESTION_HISTORY = 6


@dataclass(frozen=True)
class CategoryRef:
    id: uuid.UUID
    name: str


@dataclass(frozen=True)
class BudgetRow:
    category_id: uuid.UUID
    name: str
    # As stored: per the user's income period. None = no budget for this category
    amount: Decimal | None
    # Converted to the period shown
    budget: Decimal | None
    spent: Decimal
    remaining: Decimal | None
    percent: Decimal | None
    status: BudgetStatus


@dataclass(frozen=True)
class BudgetSummary:
    period: Period
    rows: list[BudgetRow]
    # Spent on categories without a budget, plus "Sin categoría"
    unbudgeted_spent: Decimal
    total_budgeted: Decimal
    # Spent on the categories that do have a budget
    total_spent: Decimal
    total_remaining: Decimal
    # The global spending limit for the period shown (None: no limit, or not in scope)
    spending_limit: Decimal | None
    unassigned: Decimal | None
    over_limit_warning: bool | None


def budget_status(spent: Decimal, budget: Decimal | None) -> BudgetStatus:
    """none · ok · warning (80 % or more used) · over (strictly more than the budget)."""
    if budget is None:
        return "none"
    if spent > budget:
        return "over"
    # Compared without rounding: 79.99 % is still ok, 80 % is a warning
    if spent * 100 >= budget * WARNING_PERCENT:
        return "warning"
    return "ok"


def used_percent(spent: Decimal, budget: Decimal) -> Decimal:
    return (spent * 100 / budget).quantize(HUNDREDTH, rounding=ROUND_HALF_UP)


def build_budget_summary(
    *,
    period: Period,
    categories: Sequence[CategoryRef],
    spending: Sequence[CategorySpending],
    budgets: dict[uuid.UUID, Decimal],
    income_cadence: Cadence,
    shown_cadence: Cadence,
    spending_limit: Decimal | None,
) -> BudgetSummary:
    """Each category's budget for the period shown against what was spent on it.

    `spending` comes from `spending_by_category` for `period`; `spending_limit` is the
    global limit already converted to the period shown (`limit_for`).
    """
    spent_by = {s.category_id: s.amount for s in spending}
    rows: list[BudgetRow] = []
    for category in categories:
        spent = spent_by.get(category.id, ZERO)
        amount = budgets.get(category.id)
        budget = None if amount is None else convert_amount(amount, income_cadence, shown_cadence)
        rows.append(
            BudgetRow(
                category_id=category.id,
                name=category.name,
                amount=amount,
                budget=budget,
                spent=spent,
                remaining=None if budget is None else budget - spent,
                percent=None if budget is None else used_percent(spent, budget),
                status=budget_status(spent, budget),
            )
        )
    # Budgeted categories first (alphabetically), then the rest by what they took
    rows.sort(key=lambda r: (r.budget is None, -r.spent if r.budget is None else 0, r.name))

    budgeted = [r for r in rows if r.budget is not None]
    total_budgeted = sum((r.budget for r in budgeted if r.budget is not None), ZERO)
    total_spent = sum((r.spent for r in budgeted), ZERO)
    budgeted_ids = {r.category_id for r in budgeted}
    unbudgeted_spent = sum((s.amount for s in spending if s.category_id not in budgeted_ids), ZERO)
    return BudgetSummary(
        period=period,
        rows=rows,
        unbudgeted_spent=money(unbudgeted_spent),
        total_budgeted=money(total_budgeted),
        total_spent=money(total_spent),
        total_remaining=money(total_budgeted - total_spent),
        spending_limit=spending_limit,
        unassigned=None if spending_limit is None else money(spending_limit - total_budgeted),
        over_limit_warning=None if spending_limit is None else total_budgeted > spending_limit,
    )


def suggested_budgets(
    data: FinanceData, cadence: Cadence, current: Period
) -> dict[uuid.UUID, Decimal]:
    """A starting budget per category: the average of the last 6 complete periods.

    Like the forecast's average (complete periods since `balance_as_of` only), so a
    half-recorded period does not drag it down. A brand-new user, without any complete
    period, gets what they spent in the current one. Uncategorized spending is left out:
    it cannot have a budget.
    """
    periods = complete_periods(data, cadence, current, max_periods=SUGGESTION_HISTORY)
    windows = periods or [current]
    totals: dict[uuid.UUID, Decimal] = {}
    for window in windows:
        for row in spending_by_category(data, window):
            if row.category_id is not None:
                totals[row.category_id] = totals.get(row.category_id, ZERO) + row.amount
    return {cid: money(total / len(windows)) for cid, total in totals.items() if total > 0}
