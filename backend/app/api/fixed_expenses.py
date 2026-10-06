import uuid

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.models import FixedExpense
from app.schemas.finance import FixedExpenseIn, FixedExpenseOut
from app.services import ownership
from app.services.categories import ensure_usable

router = APIRouter(prefix="/fixed-expenses", tags=["fixed expenses"])


@router.get("", response_model=list[FixedExpenseOut])
def list_fixed_expenses(db: DbSession, user: CurrentUser) -> list[FixedExpenseOut]:
    expenses = ownership.list_owned(db, FixedExpense, user, FixedExpense.created_at)
    return [FixedExpenseOut.model_validate(e) for e in expenses]


@router.post("", response_model=FixedExpenseOut, status_code=status.HTTP_201_CREATED)
def create_fixed_expense(body: FixedExpenseIn, db: DbSession, user: CurrentUser) -> FixedExpenseOut:
    ensure_usable(db, user, body.category_id)
    expense = ownership.create_owned(db, FixedExpense, user, body.model_dump())
    return FixedExpenseOut.model_validate(expense)


@router.get("/{expense_id}", response_model=FixedExpenseOut)
def get_fixed_expense(expense_id: uuid.UUID, db: DbSession, user: CurrentUser) -> FixedExpenseOut:
    return FixedExpenseOut.model_validate(ownership.get_owned(db, FixedExpense, expense_id, user))


@router.put("/{expense_id}", response_model=FixedExpenseOut)
def update_fixed_expense(
    expense_id: uuid.UUID, body: FixedExpenseIn, db: DbSession, user: CurrentUser
) -> FixedExpenseOut:
    expense = ownership.get_owned(db, FixedExpense, expense_id, user)
    ensure_usable(db, user, body.category_id)
    return FixedExpenseOut.model_validate(ownership.update_owned(db, expense, body.model_dump()))


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fixed_expense(expense_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    ownership.delete_owned(db, ownership.get_owned(db, FixedExpense, expense_id, user))
