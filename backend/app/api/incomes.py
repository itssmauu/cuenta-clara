import uuid

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.models import Income
from app.schemas.finance import IncomeIn, IncomeOut
from app.services import ownership
from app.services.accounts import with_account

router = APIRouter(prefix="/incomes", tags=["incomes"])


@router.get("", response_model=list[IncomeOut])
def list_incomes(db: DbSession, user: CurrentUser) -> list[IncomeOut]:
    incomes = ownership.list_owned(db, Income, user, Income.created_at)
    return [IncomeOut.model_validate(i) for i in incomes]


@router.post("", response_model=IncomeOut, status_code=status.HTTP_201_CREATED)
def create_income(body: IncomeIn, db: DbSession, user: CurrentUser) -> IncomeOut:
    data = with_account(db, user, body.model_dump(), creating=True)
    return IncomeOut.model_validate(ownership.create_owned(db, Income, user, data))


@router.get("/{income_id}", response_model=IncomeOut)
def get_income(income_id: uuid.UUID, db: DbSession, user: CurrentUser) -> IncomeOut:
    return IncomeOut.model_validate(ownership.get_owned(db, Income, income_id, user))


@router.put("/{income_id}", response_model=IncomeOut)
def update_income(
    income_id: uuid.UUID, body: IncomeIn, db: DbSession, user: CurrentUser
) -> IncomeOut:
    income = ownership.get_owned(db, Income, income_id, user)
    data = with_account(db, user, body.model_dump(), creating=False)
    return IncomeOut.model_validate(ownership.update_owned(db, income, data))


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_income(income_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    ownership.delete_owned(db, ownership.get_owned(db, Income, income_id, user))
