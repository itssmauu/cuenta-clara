from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.finance import SettingsIn, SettingsOut
from app.services import settings as settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def read_settings(db: DbSession, user: CurrentUser) -> SettingsOut:
    return SettingsOut.model_validate(settings_service.get_settings_for(db, user))


@router.put("", response_model=SettingsOut)
def replace_settings(body: SettingsIn, db: DbSession, user: CurrentUser) -> SettingsOut:
    updated = settings_service.update_settings(db, user, body.model_dump())
    return SettingsOut.model_validate(updated)
