"""Data access scoped to the authenticated user: the single place that prevents IDOR.

Every query on user-owned tables goes through these helpers, so a request can only
ever see or change rows whose user_id is the caller's.
"""

import uuid
from collections.abc import Sequence
from typing import Any, Protocol

from sqlalchemy import ColumnElement, select
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.models import User
from app.services.errors import NotFoundError


class UserOwned(Protocol):
    id: InstrumentedAttribute[uuid.UUID]
    user_id: InstrumentedAttribute[uuid.UUID]


def get_owned[T: UserOwned](db: Session, model: type[T], obj_id: uuid.UUID, user: User) -> T:
    obj = db.scalar(select(model).where(model.id == obj_id, model.user_id == user.id))
    if obj is None:
        raise NotFoundError
    return obj


def list_owned[T: UserOwned](
    db: Session,
    model: type[T],
    user: User,
    *order_by: ColumnElement[Any] | InstrumentedAttribute[Any],
) -> Sequence[T]:
    return db.scalars(select(model).where(model.user_id == user.id).order_by(*order_by)).all()


def create_owned[T: UserOwned](db: Session, model: type[T], user: User, data: dict[str, Any]) -> T:
    obj = model(**data, user_id=user.id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update_owned[T: UserOwned](db: Session, obj: T, data: dict[str, Any]) -> T:
    for field, value in data.items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_owned(db: Session, obj: UserOwned) -> None:
    db.delete(obj)
    db.commit()
