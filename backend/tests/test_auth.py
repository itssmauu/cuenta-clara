import base64
import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.database import get_sessionmaker
from app.core.security import JWT_ALGORITHM, JWT_ISSUER, create_access_token, hash_token
from app.main import app
from app.models import RefreshToken, User, UserSettings
from tests.auth_helpers import (
    API,
    STRONG_PASSWORD,
    cookie_value,
    csrf_headers,
    login,
    post_with_cookies,
    register,
    register_and_login,
    set_cookie_header,
)


def fetch_user(email: str) -> User | None:
    with get_sessionmaker()() as session:
        return session.scalar(select(User).where(User.email == email))


def run_sql(statement: object) -> None:
    with get_sessionmaker()() as session:
        session.execute(statement)  # type: ignore[call-overload]
        session.commit()


@pytest.fixture
def relaxed_ip_limit() -> Iterator[None]:
    """Lift the per-IP limit for tests that need many attempts from one client."""
    settings = get_settings()
    original = settings.login_rate_limit
    settings.login_rate_limit = "1000/minute"
    yield
    settings.login_rate_limit = original


# ── Registration ────────────────────────────────────────


def test_register_creates_account_with_hashed_password_and_settings(client: TestClient) -> None:
    response = register(client)

    assert response.status_code == 202
    user = fetch_user("ana@example.com")
    assert user is not None
    assert user.password_hash.startswith("$argon2id$")
    assert STRONG_PASSWORD not in user.password_hash
    with get_sessionmaker()() as session:
        assert session.scalar(select(UserSettings).where(UserSettings.user_id == user.id))


def test_register_normalizes_email(client: TestClient) -> None:
    register(client, email="Ana@Example.COM")

    assert login(client, email="ana@example.com").status_code == 200


def test_register_does_not_reveal_existing_emails(client: TestClient) -> None:
    first = register(client)
    second = register(client, password="Otra-Clave-Distinta-99!")

    assert (second.status_code, second.json()) == (first.status_code, first.json())
    # The existing account was not touched
    assert login(client, password="Otra-Clave-Distinta-99!").status_code == 401
    assert login(client).status_code == 200


def test_register_rejects_weak_password_with_reasons(client: TestClient) -> None:
    response = register(client, password="password123")

    assert response.status_code == 422
    assert len(response.json()["problems"]) >= 2
    assert fetch_user("ana@example.com") is None


def test_register_rejects_unexpected_fields(client: TestClient) -> None:
    response = client.post(
        f"{API}/register",
        json={"email": "a@example.com", "password": STRONG_PASSWORD, "name": "A", "is_active": 0},
    )

    assert response.status_code == 422


# ── Login ───────────────────────────────────────────────


def test_login_sets_secure_session_cookies(client: TestClient) -> None:
    response = register_and_login(client)

    assert response.json() == {
        "id": response.json()["id"],
        "email": "ana@example.com",
        "name": "Ana",
        "terms_accepted": True,
    }
    access = set_cookie_header(response, "access_token").lower()
    refresh = set_cookie_header(response, "refresh_token").lower()
    csrf = set_cookie_header(response, "csrf_token").lower()
    for cookie in (access, refresh, csrf):
        assert "secure" in cookie
        assert "samesite=lax" in cookie
    assert "httponly" in access and "path=/api;" in access
    assert "httponly" in refresh and "path=/api/v1/auth" in refresh
    assert "httponly" not in csrf  # the frontend must be able to read it


def test_refresh_token_is_stored_only_as_a_hash(client: TestClient) -> None:
    response = register_and_login(client)
    raw = cookie_value(response, "refresh_token")

    with get_sessionmaker()() as session:
        hashes = session.scalars(select(RefreshToken.token_hash)).all()
    assert hashes == [hash_token(raw)]
    assert raw not in hashes


def test_login_errors_do_not_reveal_whether_email_exists(client: TestClient) -> None:
    register(client)

    wrong_password = login(client, password="No-Es-La-Clave-1!")
    unknown_email = login(client, email="nadie@example.com")

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


@pytest.mark.usefixtures("relaxed_ip_limit")
def test_account_locks_after_repeated_failures(client: TestClient) -> None:
    register(client)
    for _ in range(get_settings().max_failed_logins):
        assert login(client, password="No-Es-La-Clave-1!").status_code == 401

    # Even the right password is refused while locked
    assert login(client).status_code == 401

    run_sql(update(User).values(locked_until=datetime.now(UTC) - timedelta(seconds=1)))
    assert login(client).status_code == 200


def test_successful_login_resets_failure_counter(client: TestClient) -> None:
    register(client)
    login(client, password="No-Es-La-Clave-1!")
    login(client)

    user = fetch_user("ana@example.com")
    assert user is not None
    assert user.failed_login_attempts == 0


def test_inactive_user_cannot_log_in(client: TestClient) -> None:
    register(client)
    run_sql(update(User).values(is_active=False))

    assert login(client).status_code == 401


def test_login_is_rate_limited_per_ip(client: TestClient) -> None:
    limit = int(get_settings().login_rate_limit.split("/")[0])
    for i in range(limit):
        assert login(client, email=f"user{i}@example.com").status_code == 401

    response = login(client, email="otro@example.com")

    assert response.status_code == 429
    assert int(response.headers["Retry-After"]) > 0


@pytest.mark.usefixtures("relaxed_ip_limit")
def test_login_is_rate_limited_per_email(client: TestClient) -> None:
    limit = int(get_settings().email_rate_limit.split("/")[0])
    for _ in range(limit):
        assert login(client, email="objetivo@example.com").status_code == 401

    assert login(client, email="objetivo@example.com").status_code == 429
    assert login(client, email="otra@example.com").status_code == 401


# ── Current user and access tokens ──────────────────────


def test_me_requires_a_session(client: TestClient) -> None:
    assert client.get(f"{API}/me").status_code == 401


def test_me_returns_the_logged_in_user(client: TestClient) -> None:
    register_and_login(client)

    response = client.get(f"{API}/me")

    assert response.status_code == 200
    assert response.json()["email"] == "ana@example.com"
    assert "password_hash" not in response.json()


def _get_me_with(token: str) -> int:
    with TestClient(app, base_url="https://testserver") as other:
        return other.get(f"{API}/me", headers={"Cookie": f"access_token={token}"}).status_code


def test_me_rejects_token_forged_with_another_key(client: TestClient) -> None:
    register(client)
    victim = fetch_user("ana@example.com")
    assert victim is not None
    now = datetime.now(UTC)
    forged = jwt.encode(
        {"sub": str(victim.id), "type": "access", "iss": JWT_ISSUER, "iat": now,
         "exp": now + timedelta(minutes=5)},
        "attacker-controlled-key-" + "x" * 32,
        JWT_ALGORITHM,
    )  # fmt: skip

    assert _get_me_with(forged) == 401


def test_user_cannot_impersonate_another_by_editing_their_token(client: TestClient) -> None:
    """Swap `sub` for the victim's id in an otherwise valid token: the signature breaks."""
    register(client, email="victima@example.com")
    victim = fetch_user("victima@example.com")
    assert victim is not None
    own_token = cookie_value(
        register_and_login(client, email="atacante@example.com"), "access_token"
    )

    header, payload, signature = own_token.split(".")
    claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    claims["sub"] = str(victim.id)
    tampered_payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()

    assert _get_me_with(f"{header}.{tampered_payload}.{signature}") == 401


def test_me_rejects_expired_token(client: TestClient) -> None:
    register(client)
    user = fetch_user("ana@example.com")
    assert user is not None

    expired = create_access_token(user.id, now=datetime.now(UTC) - timedelta(hours=1))

    assert _get_me_with(expired) == 401


# ── Refresh ─────────────────────────────────────────────


def test_refresh_rotates_the_session(client: TestClient) -> None:
    old_refresh = cookie_value(register_and_login(client), "refresh_token")

    response = client.post(f"{API}/refresh", headers=csrf_headers(client))

    assert response.status_code == 200
    new_refresh = cookie_value(response, "refresh_token")
    assert new_refresh != old_refresh
    with get_sessionmaker()() as session:
        old = session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_token(old_refresh))
        )
        assert old is not None and old.revoked_at is not None


def test_reusing_a_rotated_refresh_token_revokes_every_session(client: TestClient) -> None:
    login_response = register_and_login(client)
    stolen = cookie_value(login_response, "refresh_token")
    csrf = cookie_value(login_response, "csrf_token")
    rotated = client.post(f"{API}/refresh", headers=csrf_headers(client))
    assert rotated.status_code == 200

    # The attacker replays the old token...
    replay = post_with_cookies(
        f"{API}/refresh", {"refresh_token": stolen, "csrf_token": csrf}, csrf=csrf
    )
    assert replay.status_code == 401

    # ...and that also kills the legitimate user's current session
    assert client.post(f"{API}/refresh", headers=csrf_headers(client)).status_code == 401


def test_expired_refresh_token_is_rejected_and_cookies_cleared(client: TestClient) -> None:
    register_and_login(client)
    run_sql(update(RefreshToken).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))

    response = client.post(f"{API}/refresh", headers=csrf_headers(client))

    assert response.status_code == 401
    assert 'refresh_token=""' in set_cookie_header(response, "refresh_token")


def test_refresh_requires_csrf_token(client: TestClient) -> None:
    register_and_login(client)

    assert client.post(f"{API}/refresh").status_code == 403
    assert client.post(f"{API}/refresh", headers={"X-CSRF-Token": "wrong"}).status_code == 403


# ── Logout ──────────────────────────────────────────────


def test_logout_revokes_the_session_and_clears_cookies(client: TestClient) -> None:
    login_response = register_and_login(client)
    refresh_token = cookie_value(login_response, "refresh_token")
    csrf = cookie_value(login_response, "csrf_token")

    response = client.post(f"{API}/logout", headers=csrf_headers(client))

    assert response.status_code == 204
    assert client.get(f"{API}/me").status_code == 401
    replay = post_with_cookies(
        f"{API}/refresh", {"refresh_token": refresh_token, "csrf_token": csrf}, csrf=csrf
    )
    assert replay.status_code == 401


def test_logout_requires_csrf_token(client: TestClient) -> None:
    register_and_login(client)

    assert client.post(f"{API}/logout").status_code == 403
