"""Account registration, login with lockout, and refresh-token sessions."""

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.password_policy import password_problems
from app.core.security import (
    burn_password_check,
    create_access_token,
    generate_csrf_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    password_needs_rehash,
    verify_password,
)
from app.models import RefreshToken, User, UserSettings

logger = logging.getLogger(__name__)


class WeakPasswordError(Exception):
    def __init__(self, problems: list[str]) -> None:
        self.problems = problems


class InvalidCredentialsError(Exception):
    """Wrong email, wrong password, inactive or locked account: deliberately indistinguishable."""


class InvalidSessionError(Exception):
    """Missing, unknown, expired or revoked refresh token."""


@dataclass(frozen=True)
class SessionTokens:
    access_token: str
    refresh_token: str
    csrf_token: str


def _now() -> datetime:
    return datetime.now(UTC)


# ── Registration ────────────────────────────────────────


def register_user(db: Session, *, email: str, password: str, name: str) -> None:
    """Create the account unless the email is taken.

    It does NOT tell the caller whether the email already existed, so the endpoint can't
    be used to discover who has an account. Hashing happens first in both cases so the
    response time doesn't give it away either.
    """
    problems = password_problems(password, email=email, name=name)
    if problems:
        raise WeakPasswordError(problems)

    password_hash = hash_password(password)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        return

    user = User(email=email, password_hash=password_hash, name=name)
    db.add(user)
    try:
        db.flush()
        db.add(UserSettings(user_id=user.id))
        db.commit()
    except IntegrityError:
        # Two simultaneous registrations for the same email: the other one won
        db.rollback()
        return
    logger.info("User registered user_id=%s", user.id)


# ── Login ───────────────────────────────────────────────


def authenticate(db: Session, *, email: str, password: str) -> User:
    settings = get_settings()
    now = _now()
    # Row lock so concurrent failed attempts can't race past the counter
    user = db.scalar(select(User).where(User.email == email).with_for_update())

    if user is None:
        burn_password_check(password)
        raise InvalidCredentialsError

    if user.locked_until is not None and user.locked_until > now:
        burn_password_check(password)
        db.rollback()
        raise InvalidCredentialsError

    if not verify_password(user.password_hash, password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.max_failed_logins:
            user.locked_until = now + timedelta(minutes=settings.lockout_minutes)
            user.failed_login_attempts = 0
            logger.warning("Account temporarily locked user_id=%s", user.id)
        db.commit()
        raise InvalidCredentialsError

    if not user.is_active:
        db.rollback()
        raise InvalidCredentialsError

    user.failed_login_attempts = 0
    user.locked_until = None
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    db.commit()
    return user


# ── Sessions ────────────────────────────────────────────


def start_session(db: Session, user: User, *, user_agent: str | None) -> SessionTokens:
    now = _now()
    refresh_token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=now + timedelta(days=get_settings().refresh_token_ttl_days),
            user_agent=(user_agent or "")[:255] or None,
        )
    )
    db.commit()
    return SessionTokens(
        access_token=create_access_token(user.id, now),
        refresh_token=refresh_token,
        csrf_token=generate_csrf_token(),
    )


def rotate_session(
    db: Session, refresh_token: str | None, *, user_agent: str | None
) -> tuple[User, SessionTokens]:
    """Exchange a refresh token for a new pair; each refresh token works exactly once."""
    if not refresh_token:
        raise InvalidSessionError

    now = _now()
    stored = db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(refresh_token))
        .with_for_update()
    )
    if stored is None:
        raise InvalidSessionError

    if stored.revoked_at is not None:
        # A token that was already rotated is being replayed: someone else may have a
        # copy. Kill every session of this user so the thief's copy dies too.
        revoke_all_sessions(db, stored.user_id)
        logger.warning("Refresh token reuse detected user_id=%s", stored.user_id)
        raise InvalidSessionError

    if stored.expires_at <= now:
        db.rollback()
        raise InvalidSessionError

    user = db.get(User, stored.user_id)
    if user is None or not user.is_active:
        db.rollback()
        raise InvalidSessionError

    stored.revoked_at = now
    return user, start_session(db, user, user_agent=user_agent)


def end_session(db: Session, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == hash_token(refresh_token),
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=_now())
    )
    db.commit()


def revoke_all_sessions(db: Session, user_id: uuid.UUID) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
    db.commit()
