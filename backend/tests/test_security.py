import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.security import (
    JWT_ALGORITHM,
    JWT_ISSUER,
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    hash_token,
    verify_password,
)


def test_password_hash_uses_argon2id_and_is_salted() -> None:
    first, second = hash_password("Lluvia-Verde-2026!"), hash_password("Lluvia-Verde-2026!")

    assert first.startswith("$argon2id$")
    assert first != second  # random salt per hash


def test_verify_password() -> None:
    password_hash = hash_password("Lluvia-Verde-2026!")

    assert verify_password(password_hash, "Lluvia-Verde-2026!")
    assert not verify_password(password_hash, "lluvia-verde-2026!")
    assert not verify_password("not-a-hash", "Lluvia-Verde-2026!")


def test_access_token_round_trip() -> None:
    user_id = uuid.uuid4()

    assert decode_access_token(create_access_token(user_id)) == user_id


def test_expired_access_token_is_rejected() -> None:
    long_ago = datetime.now(UTC) - timedelta(hours=1)

    with pytest.raises(InvalidTokenError):
        decode_access_token(create_access_token(uuid.uuid4(), now=long_ago))


def _payload(**overrides: object) -> dict[str, object]:
    now = datetime.now(UTC)
    payload: dict[str, object] = {
        "sub": str(uuid.uuid4()),
        "type": "access",
        "iss": JWT_ISSUER,
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    return payload | overrides


def test_token_signed_with_another_key_is_rejected() -> None:
    forged = jwt.encode(_payload(), "attacker-key-" + "x" * 32, JWT_ALGORITHM)

    with pytest.raises(InvalidTokenError):
        decode_access_token(forged)


def test_unsigned_token_is_rejected() -> None:
    unsigned = jwt.encode(_payload(), None, algorithm="none")

    with pytest.raises(InvalidTokenError):
        decode_access_token(unsigned)


@pytest.mark.parametrize("overrides", [{"type": "refresh"}, {"iss": "someone-else"}])
def test_token_with_wrong_claims_is_rejected(overrides: dict[str, object]) -> None:
    token = jwt.encode(
        _payload(**overrides), get_settings().jwt_secret_key.get_secret_value(), JWT_ALGORITHM
    )

    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_refresh_token_hash_is_sha256_hex() -> None:
    digest = hash_token("some-token")

    assert len(digest) == 64
    assert digest == hash_token("some-token")
    assert digest != hash_token("some-token2")
