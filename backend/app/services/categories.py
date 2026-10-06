"""Categories: shared defaults (user_id NULL) plus each user's own."""

import uuid
from collections.abc import Sequence

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import Session

from app.models import Category, User
from app.services.errors import (
    ConflictError,
    ForbiddenError,
    InvalidReferenceError,
    NotFoundError,
)


def _visible_to(user: User) -> ColumnElement[bool]:
    return or_(Category.user_id.is_(None), Category.user_id == user.id)


def list_categories(db: Session, user: User) -> Sequence[Category]:
    return db.scalars(
        select(Category)
        .where(_visible_to(user))
        .order_by(Category.user_id.is_not(None), Category.name)  # defaults first
    ).all()


def ensure_usable(db: Session, user: User, category_id: uuid.UUID | None) -> None:
    """A record may only point at a default category or one of the user's own."""
    if category_id is None:
        return
    exists = db.scalar(select(Category.id).where(Category.id == category_id, _visible_to(user)))
    if exists is None:
        raise InvalidReferenceError("La categoría no existe.")


def _ensure_name_free(
    db: Session, user: User, name: str, exclude_id: uuid.UUID | None = None
) -> None:
    query = select(Category.id).where(_visible_to(user), func.lower(Category.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Category.id != exclude_id)
    if db.scalar(query) is not None:
        raise ConflictError("Ya tienes una categoría con ese nombre.")


def _get_editable(db: Session, user: User, category_id: uuid.UUID) -> Category:
    category = db.get(Category, category_id)
    if category is None or category.user_id not in (None, user.id):
        raise NotFoundError
    if category.user_id is None:
        raise ForbiddenError("Las categorías predeterminadas no se pueden modificar.")
    return category


def create_category(db: Session, user: User, *, name: str, color: str) -> Category:
    _ensure_name_free(db, user, name)
    category = Category(user_id=user.id, name=name, color=color)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_category(
    db: Session, user: User, category_id: uuid.UUID, *, name: str, color: str
) -> Category:
    category = _get_editable(db, user, category_id)
    _ensure_name_free(db, user, name, exclude_id=category.id)
    category.name, category.color = name, color
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, user: User, category_id: uuid.UUID) -> None:
    """Expenses and transactions that used it keep existing, uncategorized (ON DELETE SET NULL)."""
    category = _get_editable(db, user, category_id)
    db.delete(category)
    db.commit()
