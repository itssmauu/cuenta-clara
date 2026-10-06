from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User, UserSettings


def get_settings_for(db: Session, user: User) -> UserSettings:
    settings = db.scalar(select(UserSettings).where(UserSettings.user_id == user.id))
    if settings is None:
        # Registration creates the row; this only covers accounts made before that existed
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def update_settings(db: Session, user: User, data: dict[str, Any]) -> UserSettings:
    settings = get_settings_for(db, user)
    for field, value in data.items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings
