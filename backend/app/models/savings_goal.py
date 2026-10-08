import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


class SavingsGoal(IdMixin, TimestampMixin, Base):
    """Money the user wants to put aside for something ("Laptop", "Fondo de emergencia")."""

    __tablename__ = "savings_goals"
    __table_args__ = (
        CheckConstraint("target_amount > 0", name="target_amount_positive"),
        CheckConstraint("saved_amount >= 0", name="saved_amount_non_negative"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    target_amount: Mapped[Decimal]
    saved_amount: Mapped[Decimal] = mapped_column(server_default="0")
    due_date: Mapped[date | None]
