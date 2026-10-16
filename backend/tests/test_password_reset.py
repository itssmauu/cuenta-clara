"""Forgotten password: a 6-digit code by email, then a new password."""

import re
import smtplib
import socket
import time
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import select, update

from app import mail_check
from app.api.auth import FORGOT_MESSAGE, get_mailer
from app.core.config import get_settings
from app.core.database import get_sessionmaker
from app.main import app
from app.models import PasswordResetCode, User
from app.services import mailer as mailer_module
from app.services.mailer import Email, SmtpMailer
from app.services.password_reset import MAX_ATTEMPTS, code_email
from tests.auth_helpers import STRONG_PASSWORD, csrf_headers, login, register

API = "/api/v1/auth/password"
NEW_PASSWORD = "Montaña-Azul-2027!"


class Outbox:
    def __init__(self) -> None:
        self.sent: list[Email] = []
        self.fail = False

    def send(self, email: Email) -> None:
        if self.fail:
            raise ConnectionError("SMTP down")
        self.sent.append(email)

    def code_for(self, to: str) -> str:
        email = next(e for e in reversed(self.sent) if e.to == to and "código" in e.subject)
        match = re.search(r"\b(\d{6})\b", email.text)
        assert match, email.text
        return match.group(1)


@pytest.fixture
def outbox(client: TestClient) -> Iterator[Outbox]:
    box = Outbox()
    app.dependency_overrides[get_mailer] = lambda: box
    yield box


@pytest.fixture
def ana(client: TestClient, outbox: Outbox) -> TestClient:
    register(client, email="ana@example.com", name="Ana López")
    return client


def forgot(client: TestClient, email: str = "ana@example.com") -> int:
    response = client.post(f"{API}/forgot", json={"email": email})
    if response.status_code == 202:
        assert response.json() == {"message": FORGOT_MESSAGE}
    return response.status_code


def reset(
    client: TestClient, code: str, password: str = NEW_PASSWORD, email: str = "ana@example.com"
):  # noqa: ANN201
    return client.post(
        f"{API}/reset", json={"email": email, "code": code, "new_password": password}
    )


def stored_codes() -> list[PasswordResetCode]:
    with get_sessionmaker()() as session:
        return list(session.scalars(select(PasswordResetCode)))


# ── The happy path ──────────────────────────────────────


def test_a_forgotten_password_can_be_replaced_with_the_emailed_code(
    ana: TestClient, outbox: Outbox
) -> None:
    assert forgot(ana) == 202
    assert [e.to for e in outbox.sent] == ["ana@example.com"]
    code = outbox.code_for("ana@example.com")

    assert reset(ana, code).status_code == 204

    assert login(ana, password=STRONG_PASSWORD).status_code == 401
    assert login(ana, password=NEW_PASSWORD).status_code == 200
    assert outbox.sent[-1].subject == "Tu contraseña de Cuenta Clara cambió"
    assert stored_codes() == []  # nothing left to reuse


def test_the_reset_logs_the_account_out_everywhere(ana: TestClient, outbox: Outbox) -> None:
    assert login(ana).status_code == 200  # an open session, e.g. on a stolen laptop
    forgot(ana)

    reset(ana, outbox.code_for("ana@example.com"))

    assert ana.post("/api/v1/auth/refresh", headers=csrf_headers(ana)).status_code == 401


def test_access_tokens_issued_before_the_reset_stop_working(
    ana: TestClient, outbox: Outbox
) -> None:
    assert login(ana).status_code == 200
    assert ana.get("/api/v1/auth/me").status_code == 200
    time.sleep(1.1)  # token times are whole seconds
    forgot(ana)

    reset(ana, outbox.code_for("ana@example.com"))

    assert ana.get("/api/v1/auth/me").status_code == 401  # the old cookie is dead
    assert login(ana, password=NEW_PASSWORD).status_code == 200
    assert ana.get("/api/v1/auth/me").status_code == 200  # a fresh one, same second, works


def test_the_reset_lifts_a_temporary_lockout(ana: TestClient, outbox: Outbox) -> None:
    with get_sessionmaker()() as session:
        session.execute(update(User).values(locked_until=datetime.now(UTC) + timedelta(minutes=10)))
        session.commit()
    forgot(ana)

    reset(ana, outbox.code_for("ana@example.com"))

    assert login(ana, password=NEW_PASSWORD).status_code == 200


# ── Nobody learns who has an account ────────────────────


def test_unknown_emails_get_the_same_answer_and_no_email(
    client: TestClient, outbox: Outbox
) -> None:
    assert forgot(client, "nadie@example.com") == 202
    assert outbox.sent == []
    response = reset(client, "123456", email="nadie@example.com")
    assert response.status_code == 400
    assert response.json() == {"detail": "El código no es válido o ya venció. Pide uno nuevo."}


def test_asking_for_a_code_always_takes_the_same_minimum_time(
    client: TestClient, outbox: Outbox, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "password_reset_min_seconds", 0.3)
    started = time.monotonic()

    forgot(client, "nadie@example.com")

    assert time.monotonic() - started >= 0.3


def test_a_failing_mail_server_does_not_change_the_answer(ana: TestClient, outbox: Outbox) -> None:
    outbox.fail = True
    assert forgot(ana) == 202


# ── The code is hard to guess and works once ────────────


def test_codes_are_stored_only_as_a_keyed_hash(ana: TestClient, outbox: Outbox) -> None:
    forgot(ana)
    code = outbox.code_for("ana@example.com")

    [stored] = stored_codes()
    assert code not in stored.code_hash
    assert len(stored.code_hash) == 64


def test_wrong_codes_are_rejected_and_the_code_dies_after_a_few_tries(
    ana: TestClient, outbox: Outbox, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "login_rate_limit", "1000/minute")
    forgot(ana)
    code = outbox.code_for("ana@example.com")
    wrong = "000000" if code != "000000" else "111111"

    for _ in range(MAX_ATTEMPTS):
        assert reset(ana, wrong).status_code == 400

    assert reset(ana, code).status_code == 400  # even the right one, now
    assert login(ana, password=STRONG_PASSWORD).status_code == 200


def test_a_code_works_only_once(ana: TestClient, outbox: Outbox) -> None:
    forgot(ana)
    code = outbox.code_for("ana@example.com")
    assert reset(ana, code).status_code == 204

    assert reset(ana, code, password="Otra-Clave-Nueva-2028!").status_code == 400


def test_a_new_code_replaces_the_previous_one(ana: TestClient, outbox: Outbox) -> None:
    forgot(ana)
    first = outbox.code_for("ana@example.com")
    forgot(ana)
    second = outbox.code_for("ana@example.com")

    if first != second:
        assert reset(ana, first).status_code == 400
    assert reset(ana, second).status_code == 204


def test_expired_codes_do_not_work(ana: TestClient, outbox: Outbox) -> None:
    forgot(ana)
    code = outbox.code_for("ana@example.com")
    with get_sessionmaker()() as session:
        session.execute(
            update(PasswordResetCode).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        session.commit()

    assert reset(ana, code).status_code == 400


# ── The new password ────────────────────────────────────


def test_a_weak_new_password_is_refused_without_spending_the_code(
    ana: TestClient, outbox: Outbox
) -> None:
    forgot(ana)
    code = outbox.code_for("ana@example.com")

    response = reset(ana, code, password="anaana")
    assert response.status_code == 422
    assert response.json()["problems"]
    response = reset(ana, code, password="López-Clave-Fuerte-2027!")
    assert "No debe contener tu nombre ni tu correo." in response.json()["problems"]

    assert reset(ana, code).status_code == 204


# ── Abuse and bad input ─────────────────────────────────


def test_codes_per_email_are_limited(ana: TestClient, outbox: Outbox) -> None:
    limit = int(get_settings().password_reset_email_rate_limit.split("/")[0])
    for _ in range(limit):
        assert forgot(ana) == 202

    assert forgot(ana) == 429
    assert len(outbox.sent) == limit


@pytest.mark.parametrize(
    "body",
    [
        {"email": "ana@example.com", "code": "12345", "new_password": NEW_PASSWORD},
        {"email": "ana@example.com", "code": "abcdef", "new_password": NEW_PASSWORD},
        {"email": "ana@example.com", "code": "123456"},
        {"email": "ana@example.com", "code": "123456", "new_password": NEW_PASSWORD, "x": 1},
        {"email": "no-es-correo", "code": "123456", "new_password": NEW_PASSWORD},
    ],
)
def test_malformed_requests_are_rejected(ana: TestClient, body: dict[str, object]) -> None:
    assert ana.post(f"{API}/reset", json=body).status_code == 422


def test_without_email_configured_recovery_says_it_is_unavailable(client: TestClient) -> None:
    app.dependency_overrides[get_mailer] = lambda: None

    response = client.post(f"{API}/forgot", json={"email": "ana@example.com"})

    assert response.status_code == 503
    assert "no está disponible" in response.json()["detail"]


# ── The emails ──────────────────────────────────────────


def test_the_code_email_explains_itself_and_escapes_user_text() -> None:
    email = code_email("ana@example.com", "<b>Ana</b> López", "042137", 15)

    assert email.subject == "042137 es tu código de Cuenta Clara"
    assert "042137" in email.text and "042137" in email.html
    assert "15 minutos" in email.text
    assert "Si no lo pediste tú" in email.text
    assert "<b>Ana</b>" not in email.html and "&lt;b&gt;Ana&lt;/b&gt;" in email.html


class FakeSMTP:
    instances: list["FakeSMTP"] = []

    def __init__(self, host: str, port: int, **_: object) -> None:
        self.host, self.port = host, port
        self.calls: list[str] = []
        self.message = None
        FakeSMTP.instances.append(self)

    def __enter__(self) -> "FakeSMTP":
        return self

    def __exit__(self, *_: object) -> None:
        self.calls.append("quit")

    def starttls(self, **_: object) -> None:
        self.calls.append("starttls")

    def login(self, user: str, password: str) -> None:
        self.calls.append(f"login:{user}")

    def send_message(self, message: object) -> None:
        self.calls.append("send")
        self.message = message


@pytest.mark.parametrize(("port", "uses_starttls"), [(587, True), (465, False)])
def test_smtp_uses_tls_and_signs_in(
    monkeypatch: pytest.MonkeyPatch, port: int, uses_starttls: bool
) -> None:
    FakeSMTP.instances.clear()
    monkeypatch.setattr(mailer_module.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(mailer_module.smtplib, "SMTP_SSL", FakeSMTP)
    mailer = SmtpMailer(
        "smtp.example.com",
        port,
        "bot@example.com",
        "app-password",
        "Cuenta Clara <bot@example.com>",
    )

    mailer.send(code_email("ana@example.com", "Ana", "123456", 15))

    [server] = FakeSMTP.instances
    assert server.calls == (["starttls"] if uses_starttls else []) + [
        "login:bot@example.com",
        "send",
        "quit",
    ]
    assert server.message["From"] == "Cuenta Clara <bot@example.com>"
    assert server.message["To"] == "ana@example.com"
    assert server.message["Message-ID"].endswith("@example.com>")


# ── python -m app.mail_check ────────────────────────────


@pytest.mark.parametrize(
    ("error", "hint"),
    [
        (
            smtplib.SMTPAuthenticationError(535, b"5.7.139 basic authentication is disabled"),
            "Outlook",
        ),
        (
            smtplib.SMTPAuthenticationError(535, b"5.7.8 Username and Password not accepted"),
            "16 letras",
        ),
        (socket.gaierror("no such host"), "SMTP_HOST"),
    ],
)
def test_mail_check_explains_common_failures(error: Exception, hint: str) -> None:
    assert hint in mail_check.explain(error)


def test_mail_check_reports_missing_settings(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(get_settings(), "smtp_host", "")

    assert mail_check.main(["mail_check", "ana@example.com"]) == 1
    assert "SMTP_HOST" in capsys.readouterr().out


def test_mail_check_sends_a_test_email_without_printing_the_password(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    FakeSMTP.instances.clear()
    monkeypatch.setattr(mailer_module.smtplib, "SMTP", FakeSMTP)
    settings = get_settings()
    monkeypatch.setattr(settings, "smtp_host", "smtp.gmail.com")
    monkeypatch.setattr(settings, "smtp_port", 587)
    monkeypatch.setattr(settings, "smtp_username", "bot@gmail.com")
    monkeypatch.setattr(settings, "smtp_password", SecretStr("abcd efgh ijkl mnop"))
    monkeypatch.setattr(settings, "smtp_from", "Cuenta Clara <bot@gmail.com>")

    assert mail_check.main(["mail_check", "ana@example.com"]) == 0

    [server] = FakeSMTP.instances
    assert server.calls == ["starttls", "login:bot@gmail.com", "send", "quit"]
    output = capsys.readouterr().out
    assert "Enviado" in output and "abcd" not in output


# ── In the user's language ──────────────────────────────


def test_both_emails_follow_the_language_the_app_is_read_in(
    ana: TestClient, outbox: Outbox
) -> None:
    english = {"Accept-Language": "en"}
    assert (
        ana.post(f"{API}/forgot", json={"email": "ana@example.com"}, headers=english).status_code
        == 202
    )
    sent = outbox.sent[-1]
    assert sent.subject.endswith("is your Cuenta Clara code")
    assert "Use this code to create a new password" in sent.html
    assert '<html lang="en">' in sent.html
    code = re.search(r"\b(\d{6})\b", sent.text)
    assert code

    response = ana.post(
        f"{API}/reset",
        json={"email": "ana@example.com", "code": code.group(1), "new_password": NEW_PASSWORD},
        headers=english,
    )

    assert response.status_code == 204
    assert outbox.sent[-1].subject == "Your Cuenta Clara password changed"
