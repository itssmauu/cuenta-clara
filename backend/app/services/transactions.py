import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import Transaction, TransactionType, User


@dataclass(frozen=True)
class TransactionFilters:
    date_from: date | None = None
    date_to: date | None = None
    type: TransactionType | None = None
    category_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    # True: only someone else's money; False: only the user's own; None: both
    third_party: bool | None = None


def third_party_balance(db: Session, user: User, since: date) -> Decimal:
    """Someone else's money the user still holds: received − paid on their behalf.

    Negative when the user paid more for others than they received (they put in their
    own money). Only movements from `since` (the day tracking started) count.
    """
    signed = case(
        (Transaction.type == TransactionType.INCOME, Transaction.amount),
        else_=-Transaction.amount,
    )
    total = db.scalar(
        select(func.coalesce(func.sum(signed), 0)).where(
            Transaction.user_id == user.id,
            Transaction.third_party.is_(True),
            Transaction.occurred_on >= since,
        )
    )
    return Decimal(total or 0).quantize(Decimal("0.01"))


def list_transactions(
    db: Session, user: User, filters: TransactionFilters, *, limit: int, offset: int
) -> tuple[Sequence[Transaction], int]:
    """Newest first, scoped to the user. Returns one page plus the total match count."""
    conditions = [Transaction.user_id == user.id]
    if filters.date_from is not None:
        conditions.append(Transaction.occurred_on >= filters.date_from)
    if filters.date_to is not None:
        conditions.append(Transaction.occurred_on <= filters.date_to)
    if filters.type is not None:
        conditions.append(Transaction.type == filters.type)
    if filters.category_id is not None:
        conditions.append(Transaction.category_id == filters.category_id)
    if filters.account_id is not None:
        conditions.append(Transaction.account_id == filters.account_id)
    if filters.third_party is not None:
        conditions.append(Transaction.third_party.is_(filters.third_party))

    total = db.scalar(select(func.count()).select_from(Transaction).where(*conditions)) or 0
    items = db.scalars(
        select(Transaction)
        .where(*conditions)
        .order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return items, total
