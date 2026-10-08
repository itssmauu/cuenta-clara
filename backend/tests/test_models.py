"""Database-level invariants: the schema must reject bad data even if the API has a bug."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Account,
    AccountKind,
    Category,
    Frequency,
    Income,
    Transaction,
    TransactionType,
    User,
)


def make_user(session: Session, email: str = "ana@example.com") -> User:
    user = User(email=email, password_hash="not-a-real-hash", name="Ana")
    session.add(user)
    session.flush()
    return user


def make_account(session: Session, user: User, name: str = "Gastos", **extra: object) -> Account:
    account = Account(user_id=user.id, name=name, kind=AccountKind.SPENDING, **extra)
    session.add(account)
    session.flush()
    return account


def test_user_gets_server_defaults(db_session: Session) -> None:
    user = make_user(db_session)
    db_session.refresh(user)

    assert user.id is not None
    assert user.is_active is True
    assert user.created_at is not None


def test_email_must_be_lowercase(db_session: Session) -> None:
    with pytest.raises(IntegrityError, match="ck_users_email_lowercase"):
        make_user(db_session, email="Ana@Example.com")


def test_email_is_unique(db_session: Session) -> None:
    make_user(db_session)

    with pytest.raises(IntegrityError, match="uq_users_email"):
        make_user(db_session)


def test_money_is_stored_exactly(db_session: Session) -> None:
    user = make_user(db_session)
    account = make_account(db_session, user)
    for amount in ("0.10", "0.20"):
        db_session.add(
            Transaction(
                user_id=user.id,
                account_id=account.id,
                type=TransactionType.EXPENSE,
                amount=Decimal(amount),
                occurred_on=date(2026, 1, 1),
            )
        )
    db_session.flush()

    amounts = db_session.scalars(
        select(Transaction.amount).where(Transaction.user_id == user.id)
    ).all()

    # With float this would be 0.30000000000000004
    assert sum(amounts) == Decimal("0.30")


@pytest.mark.parametrize("amount", [Decimal("0"), Decimal("-5.00")])
def test_transaction_amount_must_be_positive(db_session: Session, amount: Decimal) -> None:
    user = make_user(db_session)
    account = make_account(db_session, user)
    db_session.add(
        Transaction(
            user_id=user.id,
            account_id=account.id,
            type=TransactionType.EXPENSE,
            amount=amount,
            occurred_on=date(2026, 1, 1),
        )
    )

    with pytest.raises(IntegrityError, match="ck_transactions_amount_positive"):
        db_session.flush()


@pytest.mark.parametrize(
    ("frequency", "custom_period_days"),
    [(Frequency.CUSTOM, None), (Frequency.WEEKLY, 10)],
)
def test_custom_period_days_only_with_custom_frequency(
    db_session: Session, frequency: Frequency, custom_period_days: int | None
) -> None:
    user = make_user(db_session)
    account = make_account(db_session, user)
    db_session.add(
        Income(
            user_id=user.id,
            account_id=account.id,
            label="Beca",
            amount=Decimal("160.00"),
            frequency=frequency,
            custom_period_days=custom_period_days,
            start_date=date(2026, 1, 1),
        )
    )

    with pytest.raises(IntegrityError, match="ck_incomes_custom_period_days_iff_custom"):
        db_session.flush()


def test_default_category_names_cannot_be_duplicated(db_session: Session) -> None:
    # NULLS NOT DISTINCT: a second shared "Comida" (user_id NULL) is a duplicate
    db_session.add(Category(user_id=None, name="Comida", color="#FF7A59"))

    with pytest.raises(IntegrityError, match="uq_categories_user_id_name"):
        db_session.flush()


def test_users_can_have_their_own_category_with_a_default_name(db_session: Session) -> None:
    user = make_user(db_session)
    db_session.add(Category(user_id=user.id, name="Comida", color="#FF7A59"))

    db_session.flush()


def test_deleting_a_user_cascades_to_their_data(db_session: Session) -> None:
    user = make_user(db_session)
    account = make_account(db_session, user)
    db_session.add(
        Transaction(
            user_id=user.id,
            account_id=account.id,
            type=TransactionType.INCOME,
            amount=Decimal("100.00"),
            occurred_on=date(2026, 1, 1),
        )
    )
    db_session.flush()

    db_session.delete(user)
    db_session.flush()

    assert db_session.scalars(select(Transaction).where(Transaction.user_id == user.id)).all() == []


def test_only_one_primary_account_per_user(db_session: Session) -> None:
    user = make_user(db_session)
    make_account(db_session, user, "Gastos", is_primary=True)

    with pytest.raises(IntegrityError, match="uq_accounts_one_primary_per_user"):
        make_account(db_session, user, "Ahorro", is_primary=True)


def test_account_names_are_unique_per_user(db_session: Session) -> None:
    user = make_user(db_session)
    make_account(db_session, user, "Ahorro")

    with pytest.raises(IntegrityError, match="uq_accounts_user_id_name"):
        make_account(db_session, user, "Ahorro")


def test_a_transfer_needs_two_different_accounts(db_session: Session) -> None:
    from app.models import Transfer

    user = make_user(db_session)
    account = make_account(db_session, user)
    db_session.add(
        Transfer(
            user_id=user.id,
            from_account_id=account.id,
            to_account_id=account.id,
            amount=Decimal("10.00"),
            occurred_on=date(2026, 1, 1),
        )
    )

    with pytest.raises(IntegrityError, match="ck_transfers_different_accounts"):
        db_session.flush()
