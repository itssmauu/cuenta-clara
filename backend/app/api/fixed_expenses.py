import uuid
from datetime import date

from fastapi import APIRouter, status

from app.api.dashboard import DateParam
from app.api.deps import CurrentUser, DbSession
from app.models import FixedExpense
from app.schemas.finance import (
    CheckInsIn,
    FixedExpenseIn,
    FixedExpenseOut,
    PendingFixedExpenseOut,
)
from app.services import check_ins, ownership
from app.services.accounts import with_account
from app.services.categories import ensure_usable

router = APIRouter(prefix="/fixed-expenses", tags=["fixed expenses"])


@router.get("", response_model=list[FixedExpenseOut])
def list_fixed_expenses(db: DbSession, user: CurrentUser) -> list[FixedExpenseOut]:
    expenses = ownership.list_owned(db, FixedExpense, user, FixedExpense.created_at)
    return [FixedExpenseOut.model_validate(e) for e in expenses]


@router.post("", response_model=FixedExpenseOut, status_code=status.HTTP_201_CREATED)
def create_fixed_expense(body: FixedExpenseIn, db: DbSession, user: CurrentUser) -> FixedExpenseOut:
    ensure_usable(db, user, body.category_id)
    data = with_account(db, user, body.model_dump(), creating=True)
    expense = ownership.create_owned(db, FixedExpense, user, data)
    return FixedExpenseOut.model_validate(expense)


# Declared before /{expense_id} so "pending" is never read as an id
@router.get("/pending", response_model=list[PendingFixedExpenseOut])
def list_pending(
    db: DbSession, user: CurrentUser, reference_date: DateParam = None
) -> list[PendingFixedExpenseOut]:
    """Occurrences due up to today that the user has not confirmed yet."""
    pending = check_ins.pending_for(db, user, reference_date or date.today())
    return [
        PendingFixedExpenseOut(
            id=p.expense.id,
            name=p.expense.name,
            amount=p.expense.amount,
            frequency=p.expense.frequency,
            category_id=p.expense.category_id,
            account_id=p.expense.account_id,
            account_name=p.account_name,
            dates=p.dates,
        )
        for p in pending
    ]


@router.post("/check-ins", status_code=status.HTTP_204_NO_CONTENT)
def answer_check_ins(
    body: CheckInsIn, db: DbSession, user: CurrentUser, reference_date: DateParam = None
) -> None:
    """Records whether each occurrence was paid; it can be answered again to change it."""
    check_ins.record_answers(
        db,
        user,
        [check_ins.Answer(a.fixed_expense_id, a.occurs_on, a.paid) for a in body.answers],
        reference_date or date.today(),
    )


@router.get("/{expense_id}", response_model=FixedExpenseOut)
def get_fixed_expense(expense_id: uuid.UUID, db: DbSession, user: CurrentUser) -> FixedExpenseOut:
    return FixedExpenseOut.model_validate(ownership.get_owned(db, FixedExpense, expense_id, user))


@router.put("/{expense_id}", response_model=FixedExpenseOut)
def update_fixed_expense(
    expense_id: uuid.UUID, body: FixedExpenseIn, db: DbSession, user: CurrentUser
) -> FixedExpenseOut:
    expense = ownership.get_owned(db, FixedExpense, expense_id, user)
    ensure_usable(db, user, body.category_id)
    data = with_account(db, user, body.model_dump(), creating=False)
    return FixedExpenseOut.model_validate(ownership.update_owned(db, expense, data))


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fixed_expense(expense_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    ownership.delete_owned(db, ownership.get_owned(db, FixedExpense, expense_id, user))
