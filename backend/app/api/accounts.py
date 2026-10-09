import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.models import Account
from app.schemas.finance import AccountIn, AccountOut
from app.services import accounts as account_service
from app.services import projections
from app.services.dashboard import UserFinance, load_user_finance

router = APIRouter(prefix="/accounts", tags=["accounts"])

DateParam = Annotated[date | None, Query(alias="date", description="Reference day; default today")]


def _out(finance: UserFinance, account: Account, today: date) -> AccountOut:
    balance = projections.balance_at_end_of(finance.data_for({account.id}), today)
    return AccountOut(
        id=account.id,
        name=account.name,
        kind=account.kind,
        initial_balance=account.initial_balance,
        is_primary=account.is_primary,
        balance=balance,
        created_at=account.created_at,
        updated_at=account.updated_at,
    )


def _single(db: DbSession, user: CurrentUser, account_id: uuid.UUID) -> AccountOut:
    finance = load_user_finance(db, user)
    account = next(a for a in finance.accounts if a.id == account_id)
    return _out(finance, account, date.today())


@router.get("", response_model=list[AccountOut])
def list_accounts(
    db: DbSession, user: CurrentUser, reference_date: DateParam = None
) -> list[AccountOut]:
    """Every account with its balance at the end of the reference day; primary first."""
    finance = load_user_finance(db, user)
    today = reference_date or date.today()
    return [_out(finance, account, today) for account in finance.accounts]


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(body: AccountIn, db: DbSession, user: CurrentUser) -> AccountOut:
    account = account_service.create_account(db, user, body.model_dump())
    return _single(db, user, account.id)


@router.put("/{account_id}", response_model=AccountOut)
def update_account(
    account_id: uuid.UUID, body: AccountIn, db: DbSession, user: CurrentUser
) -> AccountOut:
    account = account_service.update_account(db, user, account_id, body.model_dump())
    return _single(db, user, account.id)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    account_service.delete_account(db, user, account_id)
