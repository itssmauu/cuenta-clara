import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

# Argon2id with the library defaults (RFC 9106 low-memory profile: 64 MiB, t=3, p=4)
_hasher = PasswordHasher()

# Verified against when the email is unknown, so login takes the same time either way
_DUMMY_HASH = _hasher.hash("timing-equalizer-not-a-real-password")

JWT_ALGORITHM = "HS256"
JWT_ISSUER = "cuenta-clara-api"


# ── Passwords ───────────────────────────────────────────


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def burn_password_check(password: str) -> None:
    """Spend the same time as a real verification (for unknown or locked accounts)."""
    verify_password(_DUMMY_HASH, password)


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


# ── Access tokens (JWT) ─────────────────────────────────


class InvalidTokenError(Exception):
    pass


def create_access_token(user_id: uuid.UUID, now: datetime | None = None) -> str:
    settings = get_settings()
    issued_at = now or datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iss": JWT_ISSUER,
        "iat": issued_at,
        "exp": issued_at + timedelta(minutes=settings.access_token_ttl_minutes),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, settings.jwt_secret_key.get_secret_value(), JWT_ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID:
    """Return the user id of a valid access token, or raise InvalidTokenError."""
    try:
        payload = jwt.decode(
            token,
            get_settings().jwt_secret_key.get_secret_value(),
            # Pin the algorithm: never trust the token header (blocks `alg: none`)
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            options={"require": ["sub", "exp", "iat", "iss", "type"]},
        )
        if payload["type"] != "access":
            raise InvalidTokenError("wrong token type")
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError) as exc:
        raise InvalidTokenError(str(exc)) from exc


# ── Refresh tokens (opaque) ─────────────────────────────


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 is enough here: the token is 256 bits of randomness, not a guessable password."""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)
