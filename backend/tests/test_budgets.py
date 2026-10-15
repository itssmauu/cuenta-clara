"""Budgets per category: the pure calculations (no database)."""

import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.models import Frequency
from app.services.budgets import (
    CategoryRef,
    budget_status,
    build_budget_summary,
    suggested_budgets,
)
from app.services.periods import Cadence, Period
from app.services.projections import (
    FinanceData,
    Move,
    OneOff,
    Recurring,
    convert_amount,
    spending_by_category,
)

D = Decimal
MONDAY = date(2026, 10, 5)
WEEK = Period(MONDAY, date(2026, 10, 11))
WEEKLY = Cadence(Frequency.WEEKLY)
MONTHLY = Cadence(Frequency.MONTHLY)
FOOD, BUS, FUN = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
CATEGORIES = [CategoryRef(FOOD, "Comida"), CategoryRef(BUS, "Transporte"), CategoryRef(FUN, "Ocio")]


def finance(**overrides: object) -> FinanceData:
    defaults: dict[str, object] = {
        "initial_balance": D("100.00"),
        "balance_as_of": MONDAY,
        "spending_limit": None,
        "limit_cadence": WEEKLY,
    }
    return FinanceData(**(defaults | overrides))  # type: ignore[arg-type]


def spend(on: date, amount: str, category: uuid.UUID | None) -> OneOff:
    return OneOff(on=on, amount=D(amount), is_income=False, category_id=category)


def summary(  # noqa: PLR0913 - mirrors the function under test
    data: FinanceData,
    budgets: dict[uuid.UUID, Decimal],
    *,
    shown: Cadence = WEEKLY,
    period: Period = WEEK,
    limit: Decimal | None = None,
):  # noqa: ANN201
    return build_budget_summary(
        period=period,
        categories=CATEGORIES,
        spending=spending_by_category(data, period),
        budgets=budgets,
        income_cadence=WEEKLY,
        shown_cadence=shown,
        spending_limit=limit,
    )


def row(result, category: uuid.UUID):  # noqa: ANN001, ANN201
    return next(r for r in result.rows if r.category_id == category)


# ── Conversion between period lengths ───────────────────


def test_a_weekly_budget_shown_per_month_and_back() -> None:
    # 70 × 30.4375 / 7 = 304.375 → 304.38 (rounded once, at the end)
    assert convert_amount(D("70.00"), WEEKLY, MONTHLY) == D("304.38")
    assert convert_amount(D("304.38"), MONTHLY, WEEKLY) == D("70.00")


def test_the_budget_row_uses_the_period_shown() -> None:
    october = Period(date(2026, 10, 1), date(2026, 10, 31))
    data = finance(transactions=[spend(MONDAY, "100.00", FOOD)])

    result = summary(data, {FOOD: D("70.00")}, shown=MONTHLY, period=october)

    food = row(result, FOOD)
    assert food.amount == D("70.00")  # as stored, per week
    assert food.budget == D("304.38")  # per month
    assert food.remaining == D("204.38")


# ── Status thresholds ───────────────────────────────────


@pytest.mark.parametrize(
    ("spent", "status", "percent"),
    [
        ("0.00", "ok", "0.00"),
        ("79.99", "ok", "79.99"),
        ("80.00", "warning", "80.00"),
        ("100.00", "warning", "100.00"),  # spending exactly the budget is not going over
        ("100.01", "over", "100.01"),
    ],
)
def test_status_at_the_edges(spent: str, status: str, percent: str) -> None:
    data = finance(transactions=[spend(MONDAY, spent, FOOD)] if D(spent) else [])

    food = row(summary(data, {FOOD: D("100.00")}), FOOD)

    assert (food.status, food.percent) == (status, D(percent))
    assert budget_status(D(spent), D("100.00")) == status


def test_a_category_without_budget_has_no_status() -> None:
    data = finance(transactions=[spend(MONDAY, "12.00", FUN)])

    fun = row(summary(data, {}), FUN)

    assert (fun.status, fun.budget, fun.remaining, fun.percent) == ("none", None, None, None)
    assert fun.spent == D("12.00")


# ── What counts as spent ────────────────────────────────


def test_spent_is_fixed_plus_variable_never_income_or_transfers() -> None:
    data = finance(
        fixed_expenses=[
            Recurring(amount=D("30.00"), frequency=Frequency.WEEKLY, start=MONDAY, category_id=BUS)
        ],
        transactions=[
            spend(MONDAY, "5.00", BUS),
            # An income in a category and a transfer must never count as spending
            OneOff(on=MONDAY, amount=D("500.00"), is_income=True, category_id=BUS),
        ],
        moves=[Move(MONDAY, D("-200.00"))],
    )

    assert row(summary(data, {BUS: D("50.00")}), BUS).spent == D("35.00")


def test_nothing_before_balance_as_of_counts() -> None:
    wednesday = date(2026, 10, 7)
    data = finance(
        balance_as_of=wednesday,
        transactions=[spend(MONDAY, "40.00", FOOD), spend(wednesday, "10.00", FOOD)],
    )

    assert row(summary(data, {FOOD: D("50.00")}), FOOD).spent == D("10.00")


def test_unbudgeted_spending_includes_uncategorized() -> None:
    data = finance(
        transactions=[
            spend(MONDAY, "20.00", FOOD),
            spend(MONDAY, "7.00", FUN),
            spend(MONDAY, "3.00", None),
        ]
    )

    result = summary(data, {FOOD: D("50.00")})

    assert result.unbudgeted_spent == D("10.00")
    assert (result.total_budgeted, result.total_spent, result.total_remaining) == (
        D("50.00"),
        D("20.00"),
        D("30.00"),
    )


def test_budgeted_categories_come_first() -> None:
    data = finance(transactions=[spend(MONDAY, "9.00", FUN), spend(MONDAY, "1.00", FOOD)])

    names = [r.name for r in summary(data, {BUS: D("10.00")}).rows]

    assert names == ["Transporte", "Ocio", "Comida"]  # then by what they took


# ── Against the global spending limit ───────────────────


def test_budgets_over_the_limit_are_flagged() -> None:
    result = summary(finance(), {FOOD: D("80.00"), BUS: D("40.00")}, limit=D("100.00"))

    assert result.unassigned == D("-20.00")
    assert result.over_limit_warning is True


def test_budgets_within_the_limit_leave_the_rest_unassigned() -> None:
    result = summary(finance(), {FOOD: D("60.00")}, limit=D("100.00"))

    assert (result.unassigned, result.over_limit_warning) == (D("40.00"), False)


def test_without_a_limit_there_is_nothing_to_compare() -> None:
    result = summary(finance(), {FOOD: D("60.00")})

    assert (result.spending_limit, result.unassigned, result.over_limit_warning) == (
        None,
        None,
        None,
    )


# ── Suggestions ─────────────────────────────────────────


def test_suggestions_average_the_complete_periods() -> None:
    data = finance(
        balance_as_of=date(2026, 9, 21),
        transactions=[
            spend(date(2026, 9, 22), "30.00", FOOD),  # week of 21 Sep
            spend(date(2026, 9, 29), "10.00", FOOD),  # week of 28 Sep
            spend(date(2026, 9, 30), "8.00", None),  # uncategorized: never suggested
            spend(MONDAY, "500.00", FOOD),  # current week: not part of the average
        ],
    )

    assert suggested_budgets(data, WEEKLY, WEEK) == {FOOD: D("20.00")}


def test_a_new_user_gets_what_they_spent_so_far() -> None:
    data = finance(transactions=[spend(MONDAY, "12.50", BUS)])

    assert suggested_budgets(data, WEEKLY, WEEK) == {BUS: D("12.50")}
