"""Budgets per category: set, remove, and see how each one is going."""

import uuid
from datetime import date

from fastapi import APIRouter, status
from sqlalchemy import delete, func
from sqlalchemy.dialects.postgresql import insert

from app.api.dashboard import AccountParam, DateParam, PeriodParam, cadence_from_param
from app.api.deps import CurrentUser, DbSession
from app.models import CategoryBudget
from app.schemas.budgets import (
    BudgetIn,
    BudgetOut,
    BudgetPeriodOut,
    BudgetRowOut,
    BudgetSuggestionOut,
    BudgetSuggestionsOut,
    BudgetSummaryOut,
    BudgetTotalsOut,
)
from app.schemas.dashboard import AccountRef
from app.services import budgets as budget_service
from app.services import projections
from app.services.budget_store import load_budgets
from app.services.categories import get_visible, list_categories
from app.services.dashboard import load_user_finance
from app.services.periods import Cadence
from app.services.settings import get_settings_for

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=BudgetSummaryOut)
def get_budgets(
    db: DbSession,
    user: CurrentUser,
    period: PeriodParam = None,
    reference_date: DateParam = None,
    account: AccountParam = None,
) -> BudgetSummaryOut:
    """Each category's budget for the period against what was spent on it."""
    today = reference_date or date.today()
    finance = load_user_finance(db, user, today)
    ids, single = finance.resolve(account)
    data = finance.data_for(ids)
    cadence = cadence_from_param(period, data.limit_cadence)
    window = cadence.containing(today)
    summary = budget_service.build_budget_summary(
        period=window,
        categories=[budget_service.CategoryRef(c.id, c.name) for c in list_categories(db, user)],
        spending=projections.spending_by_category(data, window),
        budgets=load_budgets(db, user),
        income_cadence=data.limit_cadence,
        shown_cadence=cadence,
        spending_limit=projections.limit_for(data, cadence),
    )
    return BudgetSummaryOut(
        account=AccountRef.model_validate(single) if single else None,
        currency=finance.settings.currency,
        income_period=data.limit_cadence.frequency,
        period=BudgetPeriodOut(start=window.start, end=window.end, type=cadence.frequency),
        rows=[BudgetRowOut.model_validate(row, from_attributes=True) for row in summary.rows],
        unbudgeted_spent=summary.unbudgeted_spent,
        totals=BudgetTotalsOut(
            budgeted=summary.total_budgeted,
            spent=summary.total_spent,
            remaining=summary.total_remaining,
        ),
        spending_limit=summary.spending_limit,
        unassigned=summary.unassigned,
        over_limit_warning=summary.over_limit_warning,
    )


# Declared before /{category_id} so "suggestions" is never read as an id
@router.get("/suggestions", response_model=BudgetSuggestionsOut)
def get_suggestions(
    db: DbSession,
    user: CurrentUser,
    period: PeriodParam = None,
    reference_date: DateParam = None,
    account: AccountParam = None,
) -> BudgetSuggestionsOut:
    """A starting amount per category from the average of recent complete periods."""
    today = reference_date or date.today()
    finance = load_user_finance(db, user, today)
    ids, _ = finance.resolve(account)
    data = finance.data_for(ids)
    cadence: Cadence = cadence_from_param(period, data.limit_cadence)
    current = cadence.containing(today)
    amounts = budget_service.suggested_budgets(data, cadence, current)
    names = {c.id: c.name for c in list_categories(db, user)}
    history = projections.complete_periods(
        data, cadence, current, max_periods=budget_service.SUGGESTION_HISTORY
    )
    return BudgetSuggestionsOut(
        period=cadence.frequency,
        based_on_periods=len(history),
        suggestions=sorted(
            (
                BudgetSuggestionOut(category_id=cid, name=names[cid], amount=amount)
                for cid, amount in amounts.items()
                if cid in names
            ),
            key=lambda s: (-s.amount, s.name),
        ),
    )


@router.put("/{category_id}", response_model=BudgetOut)
def set_budget(
    category_id: uuid.UUID, body: BudgetIn, db: DbSession, user: CurrentUser
) -> BudgetOut:
    """Create or change the budget of a default category or one of the user's own."""
    get_visible(db, user, category_id)  # someone else's category: 404
    statement = insert(CategoryBudget).values(
        user_id=user.id, category_id=category_id, amount=body.amount
    )
    db.execute(
        statement.on_conflict_do_update(
            index_elements=["user_id", "category_id"],
            set_={"amount": statement.excluded.amount, "updated_at": func.now()},
        )
    )
    db.commit()
    return BudgetOut(
        category_id=category_id,
        amount=body.amount,
        income_period=get_settings_for(db, user).income_period,
    )


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_budget(category_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    """Drop the category's budget (nothing to drop is fine too)."""
    get_visible(db, user, category_id)
    db.execute(
        delete(CategoryBudget).where(
            CategoryBudget.user_id == user.id, CategoryBudget.category_id == category_id
        )
    )
    db.commit()
