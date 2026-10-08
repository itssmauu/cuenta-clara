"""The user's accounts: always at least one, and exactly one of them primary.

The primary account is the day-to-day one. Registration creates it, it cannot be deleted,
and making another account primary takes the role away from it in the same transaction.
"""

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import exists, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Account,
    AccountKind,
    FixedExpense,
    Income,
    SavingsGoal,
    Transaction,
    Transfer,
    User,
)
from app.services.errors import BusinessRuleError, ConflictError, NotFoundError

MAX_ACCOUNTS = 10
DEFAULT_NAME = "Cuenta principal"
DUPLICATE_NAME = "Ya tienes una cuenta con ese nombre."


def create_primary_account(db: Session, user: User) -> Account:
    """The account every user starts with (the caller commits)."""
    account = Account(
        user_id=user.id, name=DEFAULT_NAME, kind=AccountKind.SPENDING, is_primary=True
    )
    db.add(account)
    return account


def list_accounts(db: Session, user: User) -> Sequence[Account]:
    """Primary first, then in the order they were created."""
    accounts = db.scalars(
        select(Account)
        .where(Account.user_id == user.id)
        .order_by(Account.is_primary.desc(), Account.created_at, Account.name)
    ).all()
    if not accounts:
        # Only for users registered before accounts existed and missed by the migration
        create_primary_account(db, user)
        db.commit()
        return list_accounts(db, user)
    return accounts


def get_account(db: Session, user: User, account_id: uuid.UUID) -> Account:
    account = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == user.id))
    if account is None:
        raise NotFoundError
    return account


def primary_account(db: Session, user: User) -> Account:
    return list_accounts(db, user)[0]


def resolve_account_id(db: Session, user: User, account_id: uuid.UUID | None) -> uuid.UUID:
    """An account the caller owns (404 otherwise), or their primary account when omitted."""
    if account_id is None:
        return primary_account(db, user).id
    return get_account(db, user, account_id).id


def with_account(
    db: Session, user: User, data: dict[str, Any], *, creating: bool
) -> dict[str, Any]:
    """Validate the payload's account_id against the caller's accounts.

    Omitted on create: the primary account. Omitted on update: left as it was.
    """
    account_id = data.pop("account_id", None)
    if account_id is not None or creating:
        data["account_id"] = resolve_account_id(db, user, account_id)
    return data


def _lock_accounts(db: Session, user: User) -> None:
    # Serialize changes to one user's accounts (count limit and the single primary)
    db.execute(select(Account.id).where(Account.user_id == user.id).with_for_update())


def _commit_or_conflict(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ConflictError(DUPLICATE_NAME) from error


def create_account(db: Session, user: User, data: dict[str, Any]) -> Account:
    _lock_accounts(db, user)
    count = len(db.scalars(select(Account.id).where(Account.user_id == user.id)).all())
    if count >= MAX_ACCOUNTS:
        db.rollback()
        raise BusinessRuleError(f"Puedes tener hasta {MAX_ACCOUNTS} cuentas.")
    if data.get("is_primary"):
        _clear_primary(db, user)
    account = Account(**data, user_id=user.id)
    db.add(account)
    _commit_or_conflict(db)
    db.refresh(account)
    return account


def update_account(db: Session, user: User, account_id: uuid.UUID, data: dict[str, Any]) -> Account:
    _lock_accounts(db, user)
    account = get_account(db, user, account_id)
    if account.is_primary and not data["is_primary"]:
        db.rollback()
        raise BusinessRuleError(
            "Siempre necesitas una cuenta principal: "
            "marca otra como principal y esta dejará de serlo."
        )
    if data["is_primary"] and not account.is_primary:
        _clear_primary(db, user)
    for field, value in data.items():
        setattr(account, field, value)
    _commit_or_conflict(db)
    db.refresh(account)
    return account


def _clear_primary(db: Session, user: User) -> None:
    db.execute(
        update(Account)
        .where(Account.user_id == user.id, Account.is_primary.is_(True))
        .values(is_primary=False)
    )
    db.flush()


def delete_account(db: Session, user: User, account_id: uuid.UUID) -> None:
    account = get_account(db, user, account_id)
    if account.is_primary:
        raise BusinessRuleError(
            "No puedes eliminar tu cuenta principal. Marca otra como principal primero."
        )
    in_use = db.scalar(
        select(
            exists().where(Transaction.account_id == account.id)
            | exists().where(Income.account_id == account.id)
            | exists().where(FixedExpense.account_id == account.id)
            | exists().where(SavingsGoal.account_id == account.id)
            | exists().where(
                (Transfer.from_account_id == account.id) | (Transfer.to_account_id == account.id)
            )
        )
    )
    if in_use:
        raise ConflictError(
            "Esta cuenta tiene movimientos, ingresos, gastos fijos o metas. "
            "Muévelos a otra cuenta o elimínalos antes de borrarla."
        )
    db.delete(account)
    db.commit()
