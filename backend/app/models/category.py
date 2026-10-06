import uuid

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


class Category(IdMixin, TimestampMixin, Base):
    """A spending category. Rows with user_id NULL are the shared defaults."""

    __tablename__ = "categories"
    __table_args__ = (
        # NULLS NOT DISTINCT so default categories (user_id NULL) can't be duplicated either
        UniqueConstraint(
            "user_id", "name", name="uq_categories_user_id_name", postgresql_nulls_not_distinct=True
        ),
        CheckConstraint("color ~ '^#[0-9A-Fa-f]{6}$'", name="color_hex"),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(50))
    color: Mapped[str] = mapped_column(String(7))
