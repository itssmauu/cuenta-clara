import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


class CategoryBudget(IdMixin, TimestampMixin, Base):
    """How much the user wants to spend on one category per income period.

    The amount is per the user's income period (the same one as spending_limit) and is
    converted by average length when another period is shown.
    """

    __tablename__ = "category_budgets"
    __table_args__ = (
        UniqueConstraint("user_id", "category_id"),
        CheckConstraint("amount > 0", name="amount_positive"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # A default category (shared) or one of the user's own; deleting it drops the budget
    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[Decimal]
