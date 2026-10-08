from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.models import Frequency
from app.schemas.dashboard import (
    CategorySpendingOut,
    DashboardOut,
    ForecastOut,
    ForecastPeriodOut,
    SeriesPoint,
    UpcomingFixedExpense,
)
from app.schemas.finance import TransactionOut
from app.services import dashboard as dashboard_service
from app.services import projections
from app.services.categories import list_categories
from app.services.periods import Cadence

router = APIRouter(tags=["dashboard"])

PeriodParam = Annotated[
    Literal["daily", "weekly", "biweekly", "monthly"] | None,
    Query(description="Defaults to the user's income period"),
]
# The client sends its local date, so "today" matches the user's timezone
DateParam = Annotated[date | None, Query(alias="date", description="Reference day; default today")]


def _cadence(period: str | None, fallback: Cadence) -> Cadence:
    return Cadence(Frequency(period)) if period else fallback


@router.get("/dashboard", response_model=DashboardOut)
def get_dashboard(
    db: DbSession, user: CurrentUser, period: PeriodParam = None, reference_date: DateParam = None
) -> DashboardOut:
    data, settings = dashboard_service.load_finance_data(db, user)
    cadence = _cadence(period, data.limit_cadence)
    result = projections.build_dashboard(data, cadence, reference_date or date.today())

    return DashboardOut(
        period=cadence.frequency,
        period_start=result.period.start,
        period_end=result.period.end,
        currency=settings.currency,
        initial_balance=data.initial_balance,
        balance_as_of=data.balance_as_of,
        opening_balance=result.opening_balance,
        income=result.totals.income,
        fixed_expenses=result.totals.fixed_expenses,
        variable_expenses=result.totals.variable_expenses,
        spent=result.totals.spent,
        available_balance=result.available_balance,
        spending_limit=result.limit,
        limit_remaining=result.limit_remaining,
        limit_used_percent=result.limit_used_percent,
        over_limit=result.over_limit,
        limit_status=result.limit_status,
        previous_period_start=result.previous_period.start,
        previous_period_end=result.previous_period.end,
        previous_income=result.previous_totals.income,
        previous_spent=result.previous_totals.spent,
        spending_by_category=_by_category(db, user, result.by_category),
        series=[
            SeriesPoint(
                period_start=point.period.start,
                period_end=point.period.end,
                spent=point.spent,
                limit=point.limit,
                over_limit=point.over_limit,
            )
            for point in result.series
        ],
        upcoming_fixed_expenses=[
            UpcomingFixedExpense(
                id=u.expense.id,
                name=u.expense.name,
                amount=u.expense.amount,
                due_on=u.due_on,
                category_id=u.expense.category_id,
            )
            for u in result.upcoming
            if u.expense.id is not None
        ],
        recent_transactions=[
            TransactionOut.model_validate(t)
            for t in dashboard_service.recent_transactions(db, user)
        ],
    )


def _by_category(
    db: DbSession, user: CurrentUser, rows: list[projections.CategorySpending]
) -> list[CategorySpendingOut]:
    names = {c.id: c for c in list_categories(db, user)}
    out = []
    for row in rows:
        category = names.get(row.category_id) if row.category_id else None
        out.append(
            CategorySpendingOut(
                category_id=row.category_id,
                name=category.name if category else "Sin categoría",
                color=category.color if category else None,
                amount=row.amount,
            )
        )
    return out


@router.get("/forecast", response_model=ForecastOut)
def get_forecast(
    db: DbSession,
    user: CurrentUser,
    periods: Annotated[int, Query(ge=1, le=12)] = 4,
    period: PeriodParam = None,
    reference_date: DateParam = None,
    estimator: Annotated[
        Literal["average", "trend"],
        Query(description="average = recent mean; trend = linear regression on history"),
    ] = "average",
) -> ForecastOut:
    data, settings = dashboard_service.load_finance_data(db, user)
    cadence = _cadence(period, data.limit_cadence)
    forecast = projections.build_forecast(
        data, cadence, reference_date or date.today(), periods, estimator=estimator
    )

    return ForecastOut(
        period=cadence.frequency,
        currency=settings.currency,
        average_variable_spending=forecast.average,
        estimator=forecast.estimator,
        trend_per_period=forecast.trend_per_period,
        trend_r_squared=forecast.trend_r_squared,
        history_points=forecast.history_points,
        periods=[
            ForecastPeriodOut(
                period_start=row.period.start,
                period_end=row.period.end,
                opening_balance=row.opening_balance,
                income=row.income,
                fixed_expenses=row.fixed_expenses,
                variable_spending=row.variable_spending,
                closing_balance=row.closing_balance,
                is_current=row.is_current,
            )
            for row in forecast.periods
        ],
    )
