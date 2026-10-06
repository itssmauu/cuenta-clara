from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.cookies import ACCESS_COOKIE
from app.core.database import get_db
from app.core.security import InvalidTokenError, decode_access_token
from app.models import User

DbSession = Annotated[Session, Depends(get_db)]

_UNAUTHENTICATED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="No has iniciado sesión."
)


def get_current_user(
    db: DbSession,
    access_token: Annotated[str | None, Cookie(alias=ACCESS_COOKIE)] = None,
) -> User:
    if not access_token:
        raise _UNAUTHENTICATED
    try:
        user_id = decode_access_token(access_token)
    except InvalidTokenError:
        raise _UNAUTHENTICATED from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _UNAUTHENTICATED
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
