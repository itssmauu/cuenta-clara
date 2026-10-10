"""Loads a user's data from the database into the plain structures used by projections.py.

Everything is loaded once per request and then scoped in memory to the accounts being
viewed: one account (the dashboard of "Ahorro"), or all of them ("Todas").
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Account,
    FixedExpense,
    Frequency,
    Income,
    Transaction,
    TransactionType,
    Transfer,
    User,
)
from app.models import UserSettings as UserSettingsModel
from app.services import check_ins
from app.services.accounts import list_accounts
from app.services.errors import NotFoundError
from app.services.periods import Cadence
from app.services.projections import FinanceData, Move, OneOff, Recurring
from app.services.settings import get_settings_for

# What a request asks to see: one account by id, every account, or (None) the primary one
AccountScope = uuid.UUID | Literal["all"] | None


def cadence_for(frequency: Frequency, custom_days: int | None, anchor: date) -> Cadence:
    if frequency == Frequency.CUSTOM:
        return Cadence(frequency, custom_days, anchor)
    return Cadence(frequency)


@dataclass(frozen=True)
class UserFinance:
    """Everything the projections need about one user, across all their accounts."""

    settings: UserSettingsModel
    accounts: Sequence[Account]
    incomes: list[tuple[uuid.UUID, Recurring]]
    fixed_expenses: list[tuple[uuid.UUID, Recurring]]
    transactions: list[tuple[uuid.UUID, OneOff]]
    # (from account, to account, day, amount)
    transfers: list[tuple[uuid.UUID, uuid.UUID, date, Decimal]]

    @property
    def primary(self) -> Account:
        return next(a for a in self.accounts if a.is_primary)

    def resolve(self, scope: AccountScope) -> tuple[set[uuid.UUID], Account | None]:
        """The account ids in scope and, for a single account, that account."""
        if scope == "all":
            return {a.id for a in self.accounts}, None
        account = self.primary if scope is None else self._owned(scope)
        return {account.id}, account

    def _owned(self, account_id: uuid.UUID) -> Account:
        for account in self.accounts:
            if account.id == account_id:
                return account
        raise NotFoundError  # someone else's account looks exactly like a missing one

    def data_for(self, ids: set[uuid.UUID]) -> FinanceData:
        moves = []
        for source, target, on, amount in self.transfers:
            # A move between two accounts in scope cancels out: only edges count
            if target in ids and source not in ids:
                moves.append(Move(on, amount))
            elif source in ids and target not in ids:
                moves.append(Move(on, -amount))
        settings = self.settings
        return FinanceData(
            initial_balance=sum(
                (a.initial_balance for a in self.accounts if a.id in ids), Decimal(0)
            ),
            balance_as_of=settings.balance_as_of,
            # The spending limit is about day-to-day money: it applies when the primary
            # account is being viewed (alone or with the others), not to a savings account
            spending_limit=settings.spending_limit if self.primary.id in ids else None,
            limit_cadence=cadence_for(
                settings.income_period, settings.custom_period_days, settings.balance_as_of
            ),
            incomes=[r for account_id, r in self.incomes if account_id in ids],
            fixed_expenses=[r for account_id, r in self.fixed_expenses if account_id in ids],
            transactions=[t for account_id, t in self.transactions if account_id in ids],
            moves=moves,
        )


def load_user_finance(db: Session, user: User, today: date | None = None) -> UserFinance:
    """`today` (the user's local date) decides which fixed expenses still await an answer."""
    today = check_ins.latest_allowed_day(today or date.today())
    settings = get_settings_for(db, user)
    accounts = list_accounts(db, user)

    incomes = db.scalars(
        select(Income).where(Income.user_id == user.id, Income.is_active.is_(True))
    ).all()
    fixed_expenses = db.scalars(
        select(FixedExpense).where(
            FixedExpense.user_id == user.id, FixedExpense.is_active.is_(True)
        )
    ).all()
    transactions = db.execute(
        select(
            Transaction.account_id,
            Transaction.occurred_on,
            Transaction.amount,
            Transaction.type,
            Transaction.category_id,
        ).where(
            Transaction.user_id == user.id,
            Transaction.occurred_on >= settings.balance_as_of,
        )
    ).all()
    transfers = db.execute(
        select(
            Transfer.from_account_id, Transfer.to_account_id, Transfer.occurred_on, Transfer.amount
        ).where(Transfer.user_id == user.id, Transfer.occurred_on >= settings.balance_as_of)
    ).all()
    answers = check_ins.answers_by_expense(db, user)

    return UserFinance(
        settings=settings,
        accounts=accounts,
        incomes=[
            (
                i.account_id,
                Recurring(
                    amount=i.amount,
                    frequency=i.frequency,
                    start=i.start_date,
                    custom_days=i.custom_period_days,
                    id=i.id,
                    name=i.label,
                ),
            )
            for i in incomes
        ],
        fixed_expenses=[
            (
                f.account_id,
                Recurring(
                    amount=f.amount,
                    frequency=f.frequency,
                    start=f.start_date,
                    custom_days=f.custom_period_days,
                    day_of_month=f.due_day,
                    id=f.id,
                    name=f.name,
                    category_id=f.category_id,
                    excluded=check_ins.not_counted(
                        f, answers.get(f.id, {}), settings.balance_as_of, today
                    ),
                ),
            )
            for f in fixed_expenses
        ],
        transactions=[
            (
                account_id,
                OneOff(
                    on=on,
                    amount=amount,
                    is_income=kind == TransactionType.INCOME,
                    category_id=category_id,
                ),
            )
            for account_id, on, amount, kind, category_id in transactions
        ],
        transfers=[(source, target, on, amount) for source, target, on, amount in transfers],
    )


def load_finance_data(
    db: Session, user: User, scope: AccountScope = None, today: date | None = None
) -> tuple[FinanceData, UserSettingsModel, Account | None]:
    """The data for one account (default: the primary one) or for all of them."""
    finance = load_user_finance(db, user, today)
    ids, account = finance.resolve(scope)
    return finance.data_for(ids), finance.settings, account


def recent_transactions(
    db: Session, user: User, account_ids: set[uuid.UUID], limit: int = 5
) -> Sequence[Transaction]:
    return db.scalars(
        select(Transaction)
        .where(Transaction.user_id == user.id, Transaction.account_id.in_(account_ids))
        .order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc())
        .limit(limit)
    ).all()
