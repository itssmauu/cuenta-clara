import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Transaction, TransactionType, User


@dataclass(frozen=True)
class TransactionFilters:
    date_from: date | None = None
    date_to: date | None = None
    type: TransactionType | None = None
    category_id: uuid.UUID | None = None


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

    total = db.scalar(select(func.count()).select_from(Transaction).where(*conditions)) or 0
    items = db.scalars(
        select(Transaction)
        .where(*conditions)
        .order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return items, total
