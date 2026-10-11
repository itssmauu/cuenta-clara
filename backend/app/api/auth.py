import time
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from app.api.cookies import REFRESH_COOKIE, clear_session_cookies, set_session_cookies
from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.core.rate_limit import check_email_rate_limit, limiter
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    UserOut,
    WeakPasswordResponse,
)
from app.services import auth as auth_service
from app.services import password_reset
from app.services.mailer import Mailer, mailer_from_settings

router = APIRouter(prefix="/auth", tags=["auth"])

REGISTER_MESSAGE = "Si los datos son válidos, tu cuenta está lista. Inicia sesión para continuar."
INVALID_CREDENTIALS = "Correo o contraseña incorrectos, o la cuenta está bloqueada temporalmente."
INVALID_SESSION = "Tu sesión expiró. Inicia sesión de nuevo."
FORGOT_MESSAGE = (
    "Si hay una cuenta con ese correo, te enviamos un código. Revisa también la carpeta de spam."
)


def get_mailer() -> Mailer | None:
    """The configured mailer, or None if email is not set up (tests replace this)."""
    return mailer_from_settings(get_settings())


MailerDep = Annotated[Mailer | None, Depends(get_mailer)]


def _user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


@router.post(
    "/register",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=MessageResponse,
    responses={422: {"model": WeakPasswordResponse}, 429: {"model": MessageResponse}},
)
@limiter.limit(lambda: get_settings().register_rate_limit)
def register(
    request: Request, body: RegisterRequest, db: DbSession
) -> MessageResponse | JSONResponse:
    """Create an account. The response is identical whether or not the email was already taken."""
    check_email_rate_limit("register", body.email, get_settings().email_rate_limit)
    try:
        auth_service.register_user(db, email=body.email, password=body.password, name=body.name)
    except auth_service.WeakPasswordError as exc:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={"detail": "La contraseña no es segura.", "problems": exc.problems},
        )
    return MessageResponse(message=REGISTER_MESSAGE)


@router.post("/login", response_model=UserOut, responses={401: {"model": MessageResponse}})
@limiter.limit(lambda: get_settings().login_rate_limit)
def login(request: Request, response: Response, body: LoginRequest, db: DbSession) -> UserOut:
    check_email_rate_limit("login", body.email, get_settings().email_rate_limit)
    try:
        user = auth_service.authenticate(db, email=body.email, password=body.password)
    except auth_service.InvalidCredentialsError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS) from None

    tokens = auth_service.start_session(db, user, user_agent=_user_agent(request))
    set_session_cookies(response, tokens)
    return UserOut.model_validate(user)


@router.post("/refresh", response_model=UserOut, responses={401: {"model": MessageResponse}})
def refresh(
    request: Request,
    response: Response,
    db: DbSession,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> UserOut | JSONResponse:
    try:
        user, tokens = auth_service.rotate_session(
            db, refresh_token, user_agent=_user_agent(request)
        )
    except auth_service.InvalidSessionError:
        failure = JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": INVALID_SESSION}
        )
        clear_session_cookies(failure)
        return failure

    set_session_cookies(response, tokens)
    return UserOut.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: DbSession,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> None:
    auth_service.end_session(db, refresh_token)
    clear_session_cookies(response)


# ── Forgotten password ──────────────────────────────────


@router.post(
    "/password/forgot",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=MessageResponse,
    responses={429: {"model": MessageResponse}, 503: {"model": MessageResponse}},
)
@limiter.limit(lambda: get_settings().password_reset_rate_limit)
def forgot_password(
    request: Request, body: ForgotPasswordRequest, db: DbSession, mailer: MailerDep
) -> MessageResponse:
    """Email a 6-digit code. The answer, and how long it takes, never reveal who has an account."""
    if mailer is None:
        raise password_reset.RecoveryUnavailableError
    settings = get_settings()
    check_email_rate_limit("password-reset", body.email, settings.password_reset_email_rate_limit)
    started = time.monotonic()
    password_reset.request_code(db, mailer, email=body.email)
    remaining = settings.password_reset_min_seconds - (time.monotonic() - started)
    if remaining > 0:
        time.sleep(remaining)
    return MessageResponse(message=FORGOT_MESSAGE)


@router.post(
    "/password/reset",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={
        400: {"model": MessageResponse},
        422: {"model": WeakPasswordResponse},
        429: {"model": MessageResponse},
    },
)
@limiter.limit(lambda: get_settings().login_rate_limit)
def reset_password(
    request: Request, body: ResetPasswordRequest, db: DbSession, mailer: MailerDep
) -> JSONResponse | None:
    """Set a new password with the emailed code; every open session is closed."""
    check_email_rate_limit("password-reset-code", body.email, get_settings().email_rate_limit)
    try:
        password_reset.reset_password(
            db, mailer, email=body.email, code=body.code, new_password=body.new_password
        )
    except auth_service.WeakPasswordError as exc:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={"detail": "La contraseña no es segura.", "problems": exc.problems},
        )
    return None


@router.get("/me", response_model=UserOut, responses={401: {"model": MessageResponse}})
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
