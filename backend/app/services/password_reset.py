"""Forgotten password: a 6-digit code by email, then a new password.

Security, in short:
- Asking for a code never reveals whether the email has an account (same answer, and the
  endpoint pads its response time).
- The code is random (secrets), stored only as an HMAC keyed with the server secret,
  expires in a few minutes, allows MAX_ATTEMPTS wrong tries and works once. Asking for a
  new one deletes the older ones. With the per-email limits that is at most ~15 guesses
  an hour out of a million codes.
- A successful reset logs the account out everywhere, lifts any lockout and emails a
  "your password changed" notice.
"""

import hashlib
import hmac
import html
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.i18n import Language
from app.core.password_policy import password_problems
from app.core.security import burn_password_check, hash_password
from app.models import PasswordResetCode, User
from app.services.auth import WeakPasswordError, revoke_all_sessions
from app.services.errors import DomainError
from app.services.mailer import Email, Mailer

logger = logging.getLogger(__name__)

CODE_DIGITS = 6
MAX_ATTEMPTS = 5


class InvalidResetCodeError(DomainError):
    """Wrong, expired, used up or unknown code (or email): deliberately indistinguishable."""

    status_code = 400
    message = "El código no es válido o ya venció. Pide uno nuevo."


class RecoveryUnavailableError(DomainError):
    status_code = 503
    message = "La recuperación de contraseña no está disponible en este momento."


def _now() -> datetime:
    return datetime.now(UTC)


def _hash_code(user_id: uuid.UUID, code: str) -> str:
    # Keyed: a leaked table alone is not enough to brute-force the million codes offline
    key = get_settings().jwt_secret_key.get_secret_value().encode()
    return hmac.new(key, f"{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def _active_user(db: Session, email: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email))
    return user if user is not None and user.is_active else None


# ── Step 1: send a code ─────────────────────────────────


def request_code(db: Session, mailer: Mailer, *, email: str, language: Language = "es") -> None:
    """Email a fresh code if the account exists. Silent either way."""
    user = _active_user(db, email)
    if user is None:
        return

    minutes = get_settings().password_reset_code_minutes
    code = f"{secrets.randbelow(10**CODE_DIGITS):0{CODE_DIGITS}d}"
    db.execute(delete(PasswordResetCode).where(PasswordResetCode.user_id == user.id))
    db.add(
        PasswordResetCode(
            user_id=user.id,
            code_hash=_hash_code(user.id, code),
            expires_at=_now() + timedelta(minutes=minutes),
        )
    )
    db.commit()
    try:
        mailer.send(code_email(user.email, user.name, code, minutes, language))
    except Exception as error:  # noqa: BLE001 - never tell the caller; log for the owner
        logger.error("Password reset email failed user_id=%s: %s", user.id, type(error).__name__)


# ── Step 2: check the code and set the new password ─────


def reset_password(
    db: Session,
    mailer: Mailer | None,
    *,
    email: str,
    code: str,
    new_password: str,
    language: Language = "es",
) -> None:
    user = _active_user(db, email)
    if user is None:
        burn_password_check(new_password)  # same work as a real reset
        raise InvalidResetCodeError

    problems = password_problems(new_password, email=user.email, name=user.name)
    if problems:
        raise WeakPasswordError(problems)

    stored = db.scalar(
        select(PasswordResetCode)
        .where(PasswordResetCode.user_id == user.id)
        .order_by(PasswordResetCode.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    if stored is None or stored.expires_at <= _now() or stored.attempts >= MAX_ATTEMPTS:
        db.rollback()
        burn_password_check(new_password)
        raise InvalidResetCodeError
    if not hmac.compare_digest(stored.code_hash, _hash_code(user.id, code)):
        stored.attempts += 1
        db.commit()
        burn_password_check(new_password)
        raise InvalidResetCodeError

    user.password_hash = hash_password(new_password)
    user.password_changed_at = _now()  # also ends sessions whose access token is still alive
    user.failed_login_attempts = 0
    user.locked_until = None
    db.execute(delete(PasswordResetCode).where(PasswordResetCode.user_id == user.id))
    revoke_all_sessions(db, user.id)  # commits; anyone else signed in is out
    logger.info("Password reset user_id=%s", user.id)

    if mailer is not None:
        try:
            mailer.send(changed_email(user.email, user.name, language))
        except Exception as error:  # noqa: BLE001 - the reset itself already succeeded
            logger.error(
                "Password changed email failed user_id=%s: %s", user.id, type(error).__name__
            )


# ── The emails ──────────────────────────────────────────

# Inline styles: mail clients ignore <style> blocks. No images or trackers.
PAGE = "margin:0;padding:24px;background:#f3f5fb;font-family:Arial,Helvetica,sans-serif"
CARD = "max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px"
BRAND = "margin:0 0 24px;font-weight:bold;font-size:18px;color:#5b4bdb"
TITLE = "margin:0 0 16px;font-size:22px;color:#14163a"
TEXT = "margin:0 0 16px;line-height:1.5;color:#14163a"
SOFT = "margin:0 0 16px;line-height:1.5;color:#44476e"
FOOTER = "margin:32px 0 0;font-size:12px;color:#55587e"
CODE = (
    "margin:0 0 16px;padding:16px;font-size:34px;font-weight:bold;letter-spacing:8px;"
    "text-align:center;background:#e6e3ff;border-radius:14px;color:#14163a"
)
# The wording of both emails in each language. {placeholders} are filled with str.format.
COPY: dict[Language, dict[str, str]] = {
    "es": {
        "not_you": "Si no lo pediste tú, ignora este correo: tu contraseña sigue igual.",
        "never_asked": "Nunca te pediremos este código por teléfono ni por chat.",
        "footer": "Este es un correo automático de Cuenta Clara. No respondas a este mensaje.",
        "hello_text": "Hola, {first}:",
        "hello": "Hola, {first}.",
        "code_text": "Tu código para crear una nueva contraseña en Cuenta Clara es:",
        "code_html": "Usa este código para crear una nueva contraseña:",
        "expires_text": "Vence en {minutes} minutos y solo sirve una vez. Escríbelo en {page}",
        "expires_html": "Vence en <strong>{minutes} minutos</strong> y solo sirve una vez.",
        "code_subject": "{code} es tu código de Cuenta Clara",
        "code_title": "Recupera tu contraseña",
        "changed": (
            "La contraseña de tu cuenta de Cuenta Clara acaba de cambiar y se cerraron todas "
            "las sesiones abiertas."
        ),
        "advice": (
            "Si fuiste tú, no tienes que hacer nada. Si no fuiste tú, recupera tu cuenta ya desde "
            "«¿Olvidaste tu contraseña?» y revisa la seguridad de tu correo."
        ),
        "changed_subject": "Tu contraseña de Cuenta Clara cambió",
        "changed_title": "Tu contraseña cambió",
    },
    "en": {
        "not_you": "If you didn't ask for it, ignore this email: your password stays the same.",
        "never_asked": "We will never ask you for this code by phone or chat.",
        "footer": "This is an automatic email from Cuenta Clara. Please don't reply to it.",
        "hello_text": "Hi {first},",
        "hello": "Hi {first}.",
        "code_text": "Your code to create a new password in Cuenta Clara is:",
        "code_html": "Use this code to create a new password:",
        "expires_text": "It expires in {minutes} minutes and works only once. Enter it at {page}",
        "expires_html": "It expires in <strong>{minutes} minutes</strong> and works only once.",
        "code_subject": "{code} is your Cuenta Clara code",
        "code_title": "Recover your password",
        "changed": (
            "The password of your Cuenta Clara account has just changed and every open session "
            "was closed."
        ),
        "advice": (
            "If it was you, there's nothing to do. If it wasn't, recover your account right away "
            "from “Forgot your password?” and check the security of your email."
        ),
        "changed_subject": "Your Cuenta Clara password changed",
        "changed_title": "Your password changed",
    },
}
NOT_YOU = COPY["es"]["not_you"]
NEVER_ASKED = COPY["es"]["never_asked"]


def _p(style: str, content: str) -> str:
    """A paragraph; `content` must already be safe HTML (user text goes through escape)."""
    return f'<p style="{style}">{content}</p>'


def _layout(title: str, *paragraphs: str, language: Language = "es") -> str:
    return (
        f'<!doctype html><html lang="{language}"><body style="{PAGE}"><div style="{CARD}">'
        + _p(BRAND, "Cuenta Clara")
        + f'<h1 style="{TITLE}">{title}</h1>'
        + "".join(paragraphs)
        + _p(FOOTER, COPY[language]["footer"])
        + "</div></body></html>"
    )


def _first_name(name: str) -> str:
    parts = name.split()
    return parts[0] if parts else ""


def code_email(to: str, name: str, code: str, minutes: int, language: Language = "es") -> Email:
    c = COPY[language]
    first = _first_name(name)
    page = f"{get_settings().frontend_origin}/recuperar-contrasena"
    text = (
        f"{c['hello_text'].format(first=first)}\n\n"
        f"{c['code_text']}\n\n    {code}\n\n"
        f"{c['expires_text'].format(minutes=minutes, page=page)}\n\n"
        f"{c['not_you']}\n{c['never_asked']}"
    )
    return Email(
        to=to,
        subject=c["code_subject"].format(code=code),
        text=text,
        html=_layout(
            c["code_title"],
            _p(TEXT, f"{c['hello'].format(first=html.escape(first))} {c['code_html']}"),
            _p(CODE, code),
            _p(TEXT, c["expires_html"].format(minutes=minutes)),
            _p(SOFT, f"{c['not_you']} {c['never_asked']}"),
            language=language,
        ),
    )


def changed_email(to: str, name: str, language: Language = "es") -> Email:
    c = COPY[language]
    first = _first_name(name)
    return Email(
        to=to,
        subject=c["changed_subject"],
        text=f"{c['hello_text'].format(first=first)}\n\n{c['changed']}\n\n{c['advice']}",
        html=_layout(
            c["changed_title"],
            _p(TEXT, f"{c['hello'].format(first=html.escape(first))} {c['changed']}"),
            _p(SOFT, c["advice"]),
            language=language,
        ),
    )
