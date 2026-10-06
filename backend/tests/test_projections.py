"""Unit tests for the balance / limit / forecast math (no database)."""

from datetime import date
from decimal import Decimal

from app.models import Frequency
from app.services.periods import Cadence, Period
from app.services.projections import (
    FinanceData,
    OneOff,
    Recurring,
    average_variable_spending,
    balance_at_end_of,
    build_dashboard,
    build_forecast,
    limit_for,
    totals,
)

MONDAY = date(2026, 10, 5)
WEDNESDAY = date(2026, 10, 7)
WEEKLY = Cadence(Frequency.WEEKLY)
D = Decimal


def finance(**overrides: object) -> FinanceData:
    defaults: dict[str, object] = {
        "initial_balance": D("100.00"),
        "balance_as_of": MONDAY,
        "spending_limit": None,
        "limit_cadence": WEEKLY,
    }
    return FinanceData(**(defaults | overrides))  # type: ignore[arg-type]


def expense(on: date, amount: str) -> OneOff:
    return OneOff(on=on, amount=D(amount), is_income=False)


# ── The example from the spec ───────────────────────────


def test_spec_example_100_minus_30_plus_160_is_230() -> None:
    """Initial $100, weekly spending $30 → $70; $160 comes in that week → $230."""
    data = finance(
        incomes=[Recurring(amount=D("160.00"), frequency=Frequency.WEEKLY, start=MONDAY)],
        transactions=[expense(MONDAY, "30.00")],
    )

    dashboard = build_dashboard(data, WEEKLY, WEDNESDAY)

    assert dashboard.opening_balance == D("100.00")
    assert dashboard.totals.spent == D("30.00")
    assert dashboard.opening_balance - dashboard.totals.spent == D("70.00")
    assert dashboard.totals.income == D("160.00")
    assert dashboard.available_balance == D("230.00")


def test_spec_example_with_the_30_as_a_fixed_expense() -> None:
    data = finance(
        incomes=[Recurring(amount=D("160.00"), frequency=Frequency.WEEKLY, start=MONDAY)],
        fixed_expenses=[Recurring(amount=D("30.00"), frequency=Frequency.WEEKLY, start=MONDAY)],
    )

    dashboard = build_dashboard(data, WEEKLY, WEDNESDAY)

    assert dashboard.totals.fixed_expenses == D("30.00")
    assert dashboard.totals.variable_expenses == D("0.00")
    assert dashboard.available_balance == D("230.00")


# ── Balance rules ───────────────────────────────────────


def test_nothing_before_balance_as_of_counts() -> None:
    data = finance(
        transactions=[expense(date(2026, 10, 4), "50.00"), expense(MONDAY, "10.00")],
        incomes=[Recurring(amount=D("20.00"), frequency=Frequency.DAILY, start=date(2026, 10, 1))],
    )

    week = totals(data, WEEKLY.containing(MONDAY))

    assert week.variable_expenses == D("10.00")  # the $50 on Sunday is before as_of
    assert week.income == D("140.00")  # 7 days x $20, none before Monday


def test_balance_carries_over_between_periods() -> None:
    next_monday = date(2026, 10, 12)
    data = finance(
        incomes=[Recurring(amount=D("160.00"), frequency=Frequency.WEEKLY, start=MONDAY)],
        transactions=[expense(MONDAY, "30.00"), expense(next_monday, "50.00")],
    )

    dashboard = build_dashboard(data, WEEKLY, next_monday)

    assert dashboard.opening_balance == D("230.00")
    assert dashboard.available_balance == D("340.00")  # 230 + 160 − 50
    assert dashboard.available_balance == (
        dashboard.opening_balance + dashboard.totals.income - dashboard.totals.spent
    )


def test_balance_before_tracking_started_is_the_initial_balance() -> None:
    assert balance_at_end_of(finance(), date(2026, 1, 1)) == D("100.00")


def test_inactive_items_are_not_in_the_data() -> None:
    """Only active incomes/fixed expenses are loaded, so an empty list means no effect."""
    assert totals(finance(), Period(MONDAY, WEDNESDAY)).net == D("0.00")


# ── Spending limit ──────────────────────────────────────


def test_limit_is_converted_between_period_lengths() -> None:
    monthly_limit = finance(spending_limit=D("304.38"), limit_cadence=Cadence(Frequency.MONTHLY))

    assert limit_for(monthly_limit, Cadence(Frequency.MONTHLY)) == D("304.38")
    assert limit_for(monthly_limit, WEEKLY) == D("70.00")  # 304.38 × 7 / 30.4375
    assert limit_for(monthly_limit, Cadence(Frequency.DAILY)) == D("10.00")
    assert limit_for(finance(), WEEKLY) is None


def test_over_limit_flags_and_gauge() -> None:
    data = finance(
        spending_limit=D("40.00"),
        balance_as_of=date(2026, 9, 1),
        transactions=[
            expense(date(2026, 9, 22), "45.00"),  # over
            expense(date(2026, 9, 29), "40.00"),  # exactly at the limit: not over
            expense(MONDAY, "30.00"),
        ],
    )

    dashboard = build_dashboard(data, WEEKLY, WEDNESDAY)

    assert [p.period.start for p in dashboard.series][-1] == MONDAY
    assert len(dashboard.series) == 6
    assert [p.over_limit for p in dashboard.series][-3:] == [True, False, False]
    assert dashboard.over_limit is False
    assert dashboard.limit_remaining == D("10.00")
    assert dashboard.limit_used_percent == 75


def test_over_limit_in_the_current_period() -> None:
    data = finance(spending_limit=D("20.00"), transactions=[expense(MONDAY, "25.50")])

    dashboard = build_dashboard(data, WEEKLY, WEDNESDAY)

    assert dashboard.over_limit is True
    assert dashboard.limit_remaining == D("-5.50")
    assert dashboard.limit_used_percent == 128


# ── Upcoming fixed expenses ─────────────────────────────


def test_upcoming_fixed_expenses_are_sorted_by_due_date() -> None:
    data = finance(
        fixed_expenses=[
            Recurring(
                amount=D("25.00"),
                frequency=Frequency.MONTHLY,
                start=date(2026, 9, 1),
                day_of_month=15,
                name="Internet",
            ),
            Recurring(amount=D("10.00"), frequency=Frequency.WEEKLY, start=MONDAY, name="Pasaje"),
        ]
    )

    upcoming = build_dashboard(data, WEEKLY, WEDNESDAY).upcoming

    assert [(u.expense.name, u.due_on) for u in upcoming] == [
        ("Pasaje", date(2026, 10, 12)),
        ("Internet", date(2026, 10, 15)),
    ]


# ── Forecast ────────────────────────────────────────────


def test_forecast_starts_with_the_current_period_and_projects_forward() -> None:
    data = finance(
        incomes=[Recurring(amount=D("160.00"), frequency=Frequency.WEEKLY, start=MONDAY)],
        fixed_expenses=[Recurring(amount=D("30.00"), frequency=Frequency.WEEKLY, start=MONDAY)],
    )

    forecast = build_forecast(data, WEEKLY, WEDNESDAY, periods=4)
    average, rows = forecast.average, forecast.periods

    assert average == D("0.00")
    assert [r.closing_balance for r in rows] == [D("230.00"), D("360.00"), D("490.00"), D("620.00")]
    assert rows[0].is_current and not any(r.is_current for r in rows[1:])
    assert all(a.closing_balance == b.opening_balance for a, b in zip(rows, rows[1:], strict=False))


def test_forecast_subtracts_average_variable_spending() -> None:
    data = finance(
        balance_as_of=date(2026, 9, 21),
        transactions=[
            expense(date(2026, 9, 22), "40.00"),
            expense(date(2026, 9, 30), "20.00"),
            expense(MONDAY, "5.00"),
        ],
    )

    forecast = build_forecast(data, WEEKLY, WEDNESDAY, periods=2)
    average, rows = forecast.average, forecast.periods

    assert average == D("30.00")  # (40 + 20) / 2 complete weeks
    assert rows[0].variable_spending == D("5.00")  # current week uses real spending
    assert rows[1].variable_spending == D("30.00")
    assert rows[1].closing_balance == rows[0].closing_balance - D("30.00")


def test_average_uses_current_spending_when_there_is_no_history() -> None:
    data = finance(transactions=[expense(MONDAY, "12.00")])

    assert average_variable_spending(data, WEEKLY, WEEKLY.containing(WEDNESDAY)) == D("12.00")


def test_average_ignores_partially_tracked_periods() -> None:
    data = finance(
        balance_as_of=date(2026, 9, 30),  # mid-week: that week is incomplete
        transactions=[expense(date(2026, 9, 30), "99.00"), expense(MONDAY, "10.00")],
    )

    assert average_variable_spending(data, WEEKLY, WEEKLY.containing(WEDNESDAY)) == D("10.00")
