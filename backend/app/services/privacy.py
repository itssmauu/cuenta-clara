"""The user's rights over their data (Ley 81): consent, a full copy, and deletion.

- Access and portability: `export_user_data` returns everything stored about the user in a
  plain, machine-readable structure (JSON) they can download at any time.
- Cancellation: `delete_account` removes the user; every table references users with
  ON DELETE CASCADE, so all their data goes with them in the same transaction.
- Rectification is the regular editing in the app; objection to the AI processing is
  withdrawing Balbo's consent.
"""

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.legal import TERMS_VERSION
from app.core.security import verify_password
from app.models import (
    Account,
    Category,
    FixedExpense,
    FixedExpenseCheckIn,
    Income,
    RefreshToken,
    SavingsGoal,
    Transaction,
    Transfer,
    User,
)
from app.services.errors import BusinessRuleError, ForbiddenError
from app.services.settings import get_settings_for

# Never part of the copy: credentials and internal security state
_HIDDEN = {"password_hash", "token_hash", "user_id"}


def _plain(value: Any) -> Any:
    """JSON-friendly: dates as ISO text; money, ids and enums as text."""
    if value is None or isinstance(value, bool | int | str):
        return value
    if isinstance(value, date | datetime):
        return value.isoformat()
    return str(value)


def _row(obj: Any) -> dict[str, Any]:
    return {
        column.key: _plain(getattr(obj, column.key))
        for column in obj.__table__.columns
        if column.key not in _HIDDEN
    }


def _rows(db: Session, model: Any, user: User) -> list[dict[str, Any]]:
    return [_row(o) for o in db.scalars(select(model).where(model.user_id == user.id))]


def export_user_data(db: Session, user: User) -> dict[str, Any]:
    settings = get_settings_for(db, user)
    return {
        "exportado_el": datetime.now(UTC).isoformat(),
        "formato": "Cuenta Clara · copia de tus datos (JSON)",
        "usuario": {
            "id": str(user.id),
            "nombre": user.name,
            "correo": user.email,
            "creado_el": user.created_at.isoformat(),
            "terminos_version": user.terms_version,
            "terminos_aceptados_el": (
                user.terms_accepted_at.isoformat() if user.terms_accepted_at else None
            ),
        },
        "configuracion": _row(settings),
        "cuentas": _rows(db, Account, user),
        "categorias_propias": _rows(db, Category, user),
        "ingresos_fijos": _rows(db, Income, user),
        "gastos_fijos": _rows(db, FixedExpense, user),
        # "Did you pay it?" answers, one per occurrence of a fixed expense
        "gastos_fijos_confirmados": _rows(db, FixedExpenseCheckIn, user),
        "movimientos": _rows(db, Transaction, user),
        "transferencias": _rows(db, Transfer, user),
        "metas_de_ahorro": _rows(db, SavingsGoal, user),
        # Only when and from which browser a session was opened; never the tokens
        "sesiones": [
            {
                "creada_el": t.created_at.isoformat(),
                "expira_el": t.expires_at.isoformat(),
                "revocada_el": t.revoked_at.isoformat() if t.revoked_at else None,
                "navegador": t.user_agent,
            }
            for t in db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id))
        ],
    }


def accept_terms(db: Session, user: User, version: str) -> User:
    if version != TERMS_VERSION:
        raise BusinessRuleError(
            "Esa versión de los términos ya no está vigente. Recarga la página."
        )
    user.terms_version = TERMS_VERSION
    user.terms_accepted_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)
    return user


def delete_account(db: Session, user: User, password: str) -> None:
    """Asks for the password again: deleting everything must be a deliberate act."""
    if not verify_password(user.password_hash, password):
        raise ForbiddenError("La contraseña no es correcta.")
    db.delete(user)
    db.commit()


def set_assistant_consent(db: Session, user: User, *, granted: bool) -> None:
    settings = get_settings_for(db, user)
    settings.assistant_consent_at = datetime.now(UTC) if granted else None
    db.commit()
