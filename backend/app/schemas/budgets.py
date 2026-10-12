"""Request/response models for budgets per category."""

import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field

from app.models import Frequency
from app.schemas.common import InputModel
from app.schemas.dashboard import AccountRef
from app.services.budgets import BudgetStatus

# A ceiling no personal budget gets near; it also keeps a typo from becoming a budget
MAX_BUDGET = Decimal("1000000.00")


class BudgetIn(InputModel):
    # Per the user's income period (the same period as the spending limit)
    amount: Annotated[Decimal, Field(gt=0, le=MAX_BUDGET, max_digits=12, decimal_places=2)]


class BudgetOut(BaseModel):
    category_id: uuid.UUID
    amount: Decimal
    income_period: Frequency


class BudgetPeriodOut(BaseModel):
    start: date
    end: date
    type: Frequency


class BudgetRowOut(BaseModel):
    category_id: uuid.UUID
    name: str
    # As stored (per income period); null when the category has no budget
    amount: Decimal | None
    # Converted to the period shown
    budget: Decimal | None
    spent: Decimal
    remaining: Decimal | None
    # Share of the budget used, e.g. "79.99"
    percent: Decimal | None
    status: BudgetStatus


class BudgetTotalsOut(BaseModel):
    budgeted: Decimal
    spent: Decimal
    remaining: Decimal


class BudgetSummaryOut(BaseModel):
    account: AccountRef | None
    currency: str
    income_period: Frequency
    period: BudgetPeriodOut
    rows: list[BudgetRowOut]
    unbudgeted_spent: Decimal
    totals: BudgetTotalsOut
    # The global spending limit for the period shown; the next two are null without one
    spending_limit: Decimal | None
    unassigned: Decimal | None
    over_limit_warning: bool | None


class BudgetSuggestionOut(BaseModel):
    category_id: uuid.UUID
    name: str
    amount: Decimal


class BudgetSuggestionsOut(BaseModel):
    # The period the amounts are expressed in
    period: Frequency
    # How many complete periods the average used (0: only the current one so far)
    based_on_periods: int
    suggestions: list[BudgetSuggestionOut]
