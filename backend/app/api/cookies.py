from fastapi import Response

from app.core.config import get_settings
from app.core.http_security import CSRF_COOKIE
from app.services.auth import SessionTokens

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
# The refresh token is only ever sent to the auth endpoints that need it
REFRESH_COOKIE_PATH = "/api/v1/auth"
ACCESS_COOKIE_PATH = "/api"


def set_session_cookies(response: Response, tokens: SessionTokens) -> None:
    settings = get_settings()
    common = {"secure": settings.cookie_secure, "samesite": "lax"}
    response.set_cookie(
        ACCESS_COOKIE,
        tokens.access_token,
        max_age=settings.access_token_ttl_minutes * 60,
        path=ACCESS_COOKIE_PATH,
        httponly=True,
        **common,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        tokens.refresh_token,
        max_age=settings.refresh_token_ttl_days * 24 * 3600,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        **common,
    )
    # Readable by the frontend on purpose: it copies it into the X-CSRF-Token header
    response.set_cookie(
        CSRF_COOKIE,
        tokens.csrf_token,
        max_age=settings.refresh_token_ttl_days * 24 * 3600,
        path="/",
        httponly=False,
        **common,
    )


def clear_session_cookies(response: Response) -> None:
    settings = get_settings()
    common = {"secure": settings.cookie_secure, "samesite": "lax"}
    response.delete_cookie(ACCESS_COOKIE, path=ACCESS_COOKIE_PATH, httponly=True, **common)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, httponly=True, **common)
    response.delete_cookie(CSRF_COOKIE, path="/", **common)
