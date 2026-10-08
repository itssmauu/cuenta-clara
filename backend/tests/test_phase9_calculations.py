"""Unit tests for the phase 9 math: regression, limit status, comparisons, categories, goals."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.models import Frequency
from app.services.periods import Cadence
from app.services.projections import (
    FinanceData,
    OneOff,
    Recurring,
    build_dashboard,
    build_forecast,
    spending_by_category,
)
from app.services.savings import plan_goal
from app.services.trend import fit_line

D = Decimal
MONDAY = date(2026, 10, 5)
WEDNESDAY = date(2026, 10, 7)
WEEKLY = Cadence(Frequency.WEEKLY)
FOOD, BUS = uuid.uuid4(), uuid.uuid4()


def finance(**overrides: object) -> FinanceData:
    defaults: dict[str, object] = {
        "initial_balance": D("100.00"),
        "balance_as_of": MONDAY,
        "spending_limit": D("100.00"),
        "limit_cadence": WEEKLY,
    }
    return FinanceData(**(defaults | overrides))  # type: ignore[arg-type]


def expense(on: date, amount: str, category: uuid.UUID | None = None) -> OneOff:
    return OneOff(on=on, amount=D(amount), is_income=False, category_id=category)


# ── Linear regression ───────────────────────────────────


def test_fit_line_recovers_an_exact_line() -> None:
    fit = fit_line([D(10), D(12), D(14), D(16)])  # y = 10 + 2x

    assert fit.slope == 2
    assert fit.intercept == 10
    assert fit.r_squared == 1
    assert fit.predict(4) == 18


def test_fit_line_on_flat_and_noisy_data() -> None:
    flat = fit_line([D(5), D(5), D(5)])
    noisy = fit_line([D(10), D(30), D(20), D(40)])

    assert (flat.slope, flat.r_squared) == (0, 1)
    assert noisy.slope > 0
    assert 0 < noisy.r_squared < 1


def test_fit_line_needs_two_points() -> None:
    with pytest.raises(ValueError, match="two points"):
        fit_line([D(1)])


# ── Limit status (80 % alert) ───────────────────────────


@pytest.mark.parametrize(
    ("spent", "status"),
    [("79.00", "ok"), ("80.00", "warning"), ("100.00", "warning"), ("100.01", "over")],
)
def test_limit_status(spent: str, status: str) -> None:
    dashboard = build_dashboard(finance(transactions=[expense(MONDAY, spent)]), WEEKLY, WEDNESDAY)

    assert dashboard.limit_status == status


def test_limit_status_without_a_limit() -> None:
    dashboard = build_dashboard(finance(spending_limit=None), WEEKLY, WEDNESDAY)

    assert dashboard.limit_status == "none"


# ── Comparison with the previous period ─────────────────


def test_dashboard_includes_the_previous_period() -> None:
    last_week = MONDAY - timedelta(days=5)
    data = finance(
        balance_as_of=date(2026, 9, 28),
        transactions=[expense(last_week, "40.00"), expense(MONDAY, "30.00")],
    )

    dashboard = build_dashboard(data, WEEKLY, WEDNESDAY)

    assert dashboard.previous_period.start == date(2026, 9, 28)
    assert dashboard.previous_totals.spent == D("40.00")
    assert dashboard.totals.spent == D("30.00")


# ── Spending by category ────────────────────────────────


def test_spending_by_category_mixes_fixed_and_variable_largest_first() -> None:
    data = finance(
        fixed_expenses=[
            Recurring(amount=D("30.00"), frequency=Frequency.WEEKLY, start=MONDAY, category_id=BUS)
        ],
        transactions=[
            expense(MONDAY, "12.00", FOOD),
            expense(WEDNESDAY, "13.00", FOOD),
            expense(WEDNESDAY, "5.00"),
            OneOff(on=MONDAY, amount=D("500.00"), is_income=True, category_id=FOOD),  # ignored
        ],
    )

    rows = spending_by_category(data, WEEKLY.containing(WEDNESDAY))

    assert [(r.category_id, r.amount) for r in rows] == [
        (BUS, D("30.00")),
        (FOOD, D("25.00")),
        (None, D("5.00")),
    ]


# ── Forecast with a trend ───────────────────────────────


def weekly_history(*amounts: str) -> list[OneOff]:
    """One expense per week, the oldest first, ending the week before MONDAY."""
    start = MONDAY - timedelta(weeks=len(amounts))
    return [expense(start + timedelta(weeks=i), a) for i, a in enumerate(amounts)]


def test_trend_extends_rising_spending() -> None:
    data = finance(
        balance_as_of=MONDAY - timedelta(weeks=3), transactions=weekly_history("10", "20", "30")
    )

    forecast = build_forecast(data, WEEKLY, WEDNESDAY, periods=3, estimator="trend")

    assert forecast.estimator == "trend"
    assert forecast.trend_per_period == D("10.00")
    assert forecast.trend_r_squared == D("1.00")
    # Weeks after the current one continue the line: 50, 60 (the current week is x = 3)
    assert [p.variable_spending for p in forecast.periods[1:]] == [D("50.00"), D("60.00")]


def test_trend_never_predicts_negative_spending() -> None:
    data = finance(
        balance_as_of=MONDAY - timedelta(weeks=3), transactions=weekly_history("30", "15", "1")
    )

    forecast = build_forecast(data, WEEKLY, WEDNESDAY, periods=4, estimator="trend")

    assert all(p.variable_spending >= 0 for p in forecast.periods)
    assert forecast.periods[-1].variable_spending == D("0.00")


def test_trend_falls_back_to_the_average_with_little_history() -> None:
    data = finance(
        balance_as_of=MONDAY - timedelta(weeks=2), transactions=weekly_history("10", "30")
    )

    forecast = build_forecast(data, WEEKLY, WEDNESDAY, periods=2, estimator="trend")

    assert forecast.estimator == "average"
    assert forecast.history_points == 2
    assert forecast.periods[1].variable_spending == D("20.00")


# ── Savings goal plan ───────────────────────────────────


def test_goal_plan_splits_the_remainder_over_the_periods_left() -> None:
    # Due on Sunday Oct 25: this week + 2 more → 3 periods; 100 / 3 rounded up
    plan = plan_goal(D("200"), D("100"), date(2026, 10, 25), WEDNESDAY, WEEKLY)

    assert plan.remaining == D("100.00")
    assert plan.progress_percent == 50
    assert plan.periods_left == 3
    assert plan.suggested_per_period == D("33.34")
    assert not plan.overdue


def test_goal_plan_edge_cases() -> None:
    done = plan_goal(D("100"), D("120"), date(2026, 12, 1), WEDNESDAY, WEEKLY)
    late = plan_goal(D("100"), D("10"), date(2026, 10, 1), WEDNESDAY, WEEKLY)
    open_ended = plan_goal(D("100"), D("10"), None, WEDNESDAY, WEEKLY)

    assert (done.completed, done.remaining, done.progress_percent) == (True, D("0.00"), 120)
    assert done.suggested_per_period is None
    assert (late.overdue, late.periods_left, late.suggested_per_period) == (True, 0, None)
    assert (open_ended.periods_left, open_ended.suggested_per_period) == (None, None)
