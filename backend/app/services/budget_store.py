"""Reading the stored category budgets (the calculations live in budgets.py, pure)."""

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CategoryBudget, User


def load_budgets(db: Session, user: User) -> dict[uuid.UUID, Decimal]:
    """The user's budgets by category id, per their income period."""
    rows = db.execute(
        select(CategoryBudget.category_id, CategoryBudget.amount).where(
            CategoryBudget.user_id == user.id
        )
    ).all()
    return {category_id: amount for category_id, amount in rows}
