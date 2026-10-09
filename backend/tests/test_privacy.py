"""The user's rights over their data (Ley 81): consent, a full copy and deletion."""

import json
from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import get_sessionmaker
from app.core.legal import TERMS_VERSION
from app.models import Account, Transaction, User
from tests.auth_helpers import STRONG_PASSWORD, register

API = "/api/v1"


def test_registering_requires_accepting_the_terms(client: TestClient) -> None:
    response = register(client, email="sin@example.com", accept_terms=False)

    assert response.status_code == 422
    assert "Debes aceptar los Términos" in response.text


def test_registering_records_which_terms_were_accepted_and_when(client: TestClient) -> None:
    register(client, email="nueva@example.com").raise_for_status()

    with get_sessionmaker()() as session:
        user = session.scalar(select(User).where(User.email == "nueva@example.com"))
        assert user is not None
        assert user.terms_version == TERMS_VERSION
        assert user.terms_accepted_at is not None


def test_users_with_old_terms_are_asked_to_accept_the_current_ones(
    login_as: Callable[[str], TestClient],
) -> None:
    ana = login_as("ana@example.com")
    with get_sessionmaker()() as session:
        user = session.scalar(select(User).where(User.email == "ana@example.com"))
        assert user is not None
        user.terms_version = None  # an account from before the documents existed
        session.commit()
    assert ana.get(f"{API}/auth/me").json()["terms_accepted"] is False

    assert ana.post(f"{API}/me/consent", json={"terms_version": "2020-01-01"}).status_code == 422
    accepted = ana.post(f"{API}/me/consent", json={"terms_version": TERMS_VERSION})

    assert accepted.status_code == 200
    assert accepted.json()["terms_accepted"] is True


def test_the_export_has_all_the_users_data_and_no_secrets(
    login_as: Callable[[str], TestClient],
) -> None:
    ana = login_as("ana@example.com")
    ana.post(
        f"{API}/transactions",
        json={"type": "expense", "amount": "12.50", "occurred_on": "2026-10-06", "note": "Café"},
    ).raise_for_status()

    response = ana.get(f"{API}/me/export")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert "cuenta-clara-mis-datos-" in response.headers["content-disposition"]
    data = json.loads(response.text)
    assert data["usuario"]["correo"] == "ana@example.com"
    assert data["usuario"]["terminos_version"] == TERMS_VERSION
    assert [c["name"] for c in data["cuentas"]] == ["Cuenta principal"]
    assert [(m["amount"], m["note"]) for m in data["movimientos"]] == [("12.50", "Café")]
    assert len(data["sesiones"]) == 1
    # Credentials never leave the server, not even to their owner
    for secret in ("password_hash", "token_hash", "argon2", "refresh_token"):
        assert secret not in response.text


def test_the_export_only_has_the_callers_data(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")
    ana.post(
        f"{API}/transactions",
        json={"type": "income", "amount": "50.00", "occurred_on": "2026-10-06", "note": "Ana"},
    ).raise_for_status()
    beto = login_as("beto@example.com")

    data = beto.get(f"{API}/me/export").json()

    assert data["usuario"]["correo"] == "beto@example.com"
    assert data["movimientos"] == []


def test_deleting_the_account_needs_the_password_and_removes_everything(
    login_as: Callable[[str], TestClient],
) -> None:
    ana = login_as("ana@example.com")
    ana.post(
        f"{API}/transactions",
        json={"type": "income", "amount": "50.00", "occurred_on": "2026-10-06"},
    ).raise_for_status()

    wrong = ana.post(f"{API}/me/delete", json={"password": "no-es-mi-clave"})
    assert wrong.status_code == 403

    deleted = ana.post(f"{API}/me/delete", json={"password": STRONG_PASSWORD})
    assert deleted.status_code == 204
    # The session cookies are cleared in the same response
    assert "access_token=" in deleted.headers.get("set-cookie", "")
    with get_sessionmaker()() as session:
        assert session.scalar(select(User).where(User.email == "ana@example.com")) is None
        assert session.scalars(select(Account)).all() == []
        assert session.scalars(select(Transaction)).all() == []
    assert ana.get(f"{API}/auth/me").status_code == 401


def test_privacy_endpoints_require_a_session(client: TestClient) -> None:
    assert client.get(f"{API}/me/export").status_code == 401
    assert client.post(f"{API}/me/delete", json={"password": "x"}).status_code in (401, 403)
