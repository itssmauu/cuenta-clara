"""Money moved between two of the user's accounts."""

import uuid
from collections.abc import Sequence
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Transfer, User
from app.services.accounts import get_account


def create_transfer(
    db: Session,
    user: User,
    *,
    from_account_id: uuid.UUID,
    to_account_id: uuid.UUID,
    amount: Decimal,
    occurred_on: date,
    note: str | None = None,
    goal_id: uuid.UUID | None = None,
    commit: bool = True,
) -> Transfer:
    # Both ends must be the caller's own accounts (404 otherwise, never "exists but not yours")
    get_account(db, user, from_account_id)
    get_account(db, user, to_account_id)
    transfer = Transfer(
        user_id=user.id,
        from_account_id=from_account_id,
        to_account_id=to_account_id,
        amount=amount,
        occurred_on=occurred_on,
        note=note,
        goal_id=goal_id,
    )
    db.add(transfer)
    if commit:
        db.commit()
        db.refresh(transfer)
    return transfer


def list_transfers(
    db: Session, user: User, *, account_id: uuid.UUID | None = None, limit: int = 50
) -> Sequence[Transfer]:
    """Newest first; optionally only those touching one account."""
    query = select(Transfer).where(Transfer.user_id == user.id)
    if account_id is not None:
        query = query.where(
            (Transfer.from_account_id == account_id) | (Transfer.to_account_id == account_id)
        )
    return db.scalars(
        query.order_by(Transfer.occurred_on.desc(), Transfer.created_at.desc()).limit(limit)
    ).all()
