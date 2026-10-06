import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.models import Transaction, TransactionType
from app.schemas.finance import TransactionIn, TransactionOut, TransactionPage
from app.services import ownership
from app.services import transactions as transaction_service
from app.services.categories import ensure_usable

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=TransactionPage)
def list_transactions(
    db: DbSession,
    user: CurrentUser,
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
    type: TransactionType | None = None,
    category_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TransactionPage:
    filters = transaction_service.TransactionFilters(date_from, date_to, type, category_id)
    items, total = transaction_service.list_transactions(
        db, user, filters, limit=limit, offset=offset
    )
    return TransactionPage(
        items=[TransactionOut.model_validate(t) for t in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(body: TransactionIn, db: DbSession, user: CurrentUser) -> TransactionOut:
    ensure_usable(db, user, body.category_id)
    transaction = ownership.create_owned(db, Transaction, user, body.model_dump())
    return TransactionOut.model_validate(transaction)


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(transaction_id: uuid.UUID, db: DbSession, user: CurrentUser) -> TransactionOut:
    return TransactionOut.model_validate(ownership.get_owned(db, Transaction, transaction_id, user))


@router.put("/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: uuid.UUID, body: TransactionIn, db: DbSession, user: CurrentUser
) -> TransactionOut:
    transaction = ownership.get_owned(db, Transaction, transaction_id, user)
    ensure_usable(db, user, body.category_id)
    return TransactionOut.model_validate(ownership.update_owned(db, transaction, body.model_dump()))


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    ownership.delete_owned(db, ownership.get_owned(db, Transaction, transaction_id, user))
