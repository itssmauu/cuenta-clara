"""Loads a user's data from the database into the plain structures used by projections.py."""

from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FixedExpense, Frequency, Income, Transaction, TransactionType, User
from app.models import UserSettings as UserSettingsModel
from app.services.periods import Cadence
from app.services.projections import FinanceData, OneOff, Recurring
from app.services.settings import get_settings_for


def cadence_for(frequency: Frequency, custom_days: int | None, anchor: date) -> Cadence:
    if frequency == Frequency.CUSTOM:
        return Cadence(frequency, custom_days, anchor)
    return Cadence(frequency)


def load_finance_data(db: Session, user: User) -> tuple[FinanceData, UserSettingsModel]:
    settings = get_settings_for(db, user)

    incomes = db.scalars(
        select(Income).where(Income.user_id == user.id, Income.is_active.is_(True))
    ).all()
    fixed_expenses = db.scalars(
        select(FixedExpense).where(
            FixedExpense.user_id == user.id, FixedExpense.is_active.is_(True)
        )
    ).all()
    transactions = db.execute(
        select(Transaction.occurred_on, Transaction.amount, Transaction.type).where(
            Transaction.user_id == user.id,
            Transaction.occurred_on >= settings.balance_as_of,
        )
    ).all()

    data = FinanceData(
        initial_balance=settings.initial_balance,
        balance_as_of=settings.balance_as_of,
        spending_limit=settings.spending_limit,
        limit_cadence=cadence_for(
            settings.income_period, settings.custom_period_days, settings.balance_as_of
        ),
        incomes=[
            Recurring(
                amount=i.amount,
                frequency=i.frequency,
                start=i.start_date,
                custom_days=i.custom_period_days,
                id=i.id,
                name=i.label,
            )
            for i in incomes
        ],
        fixed_expenses=[
            Recurring(
                amount=f.amount,
                frequency=f.frequency,
                start=f.start_date,
                custom_days=f.custom_period_days,
                day_of_month=f.due_day,
                id=f.id,
                name=f.name,
                category_id=f.category_id,
            )
            for f in fixed_expenses
        ],
        transactions=[
            OneOff(on=on, amount=amount, is_income=kind == TransactionType.INCOME)
            for on, amount, kind in transactions
        ],
    )
    return data, settings


def recent_transactions(db: Session, user: User, limit: int = 5) -> Sequence[Transaction]:
    return db.scalars(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc())
        .limit(limit)
    ).all()
