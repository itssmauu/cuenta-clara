import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.models import Transfer
from app.schemas.finance import TransferIn, TransferOut
from app.services import ownership
from app.services import transfers as transfer_service
from app.services.accounts import get_account

router = APIRouter(prefix="/transfers", tags=["transfers"])


@router.get("", response_model=list[TransferOut])
def list_transfers(
    db: DbSession,
    user: CurrentUser,
    account_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[TransferOut]:
    if account_id is not None:
        get_account(db, user, account_id)  # 404 for someone else's account
    items = transfer_service.list_transfers(db, user, account_id=account_id, limit=limit)
    return [TransferOut.model_validate(t) for t in items]


@router.post("", response_model=TransferOut, status_code=status.HTTP_201_CREATED)
def create_transfer(body: TransferIn, db: DbSession, user: CurrentUser) -> TransferOut:
    transfer = transfer_service.create_transfer(db, user, **body.model_dump())
    return TransferOut.model_validate(transfer)


@router.delete("/{transfer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transfer(transfer_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    ownership.delete_owned(db, ownership.get_owned(db, Transfer, transfer_id, user))
