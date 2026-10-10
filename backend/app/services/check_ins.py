"""Did you pay it? Fixed expenses wait for the user's answer before they count.

From each expense's `confirm_from` day on, every occurrence is one of:

- paid    (the user said yes): it counts on its date, as before;
- skipped (the user said no):  it never counts;
- pending (due today or earlier, no answer yet): it does not count yet, and the app asks.

Occurrences after today are not asked about yet, and the forecast still expects them.
Occurrences before `confirm_from` (or before the user started tracking) count on their
own, exactly as they did before this feature existed.
"""

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core import clock
from app.models import Account, FixedExpense, FixedExpenseCheckIn, User
from app.services.errors import BusinessRuleError, NotFoundError
from app.services.periods import Period, recurring_dates
from app.services.settings import get_settings_for

# One request answers at most this many occurrences (a daily expense unanswered for a year)
MAX_ANSWERS = 400

Answers = dict[date, bool]


def occurrences(expense: FixedExpense, window: Period) -> list[date]:
    return recurring_dates(
        expense.frequency,
        expense.start_date,
        window,
        custom_days=expense.custom_period_days,
        day_of_month=expense.due_day,
    )


def askable_window(expense: FixedExpense, balance_as_of: date, today: date) -> Period | None:
    """The days whose occurrences need an answer: from confirm_from (or later) up to today."""
    start = max(expense.confirm_from, expense.start_date, balance_as_of)
    return Period(start, today) if start <= today else None


def unanswered(
    expense: FixedExpense, answers: Answers, balance_as_of: date, today: date
) -> list[date]:
    window = askable_window(expense, balance_as_of, today)
    if window is None:
        return []
    return [day for day in occurrences(expense, window) if day not in answers]


def not_counted(
    expense: FixedExpense, answers: Answers, balance_as_of: date, today: date
) -> frozenset[date]:
    """The occurrences that must not touch the balance: answered "no", or not answered yet."""
    skipped = {day for day, paid in answers.items() if not paid}
    return frozenset(skipped.union(unanswered(expense, answers, balance_as_of, today)))


def answers_by_expense(db: Session, user: User) -> dict[uuid.UUID, Answers]:
    rows = db.execute(
        select(
            FixedExpenseCheckIn.fixed_expense_id,
            FixedExpenseCheckIn.occurs_on,
            FixedExpenseCheckIn.paid,
        ).where(FixedExpenseCheckIn.user_id == user.id)
    ).all()
    answers: dict[uuid.UUID, Answers] = defaultdict(dict)
    for expense_id, on, paid in rows:
        answers[expense_id][on] = paid
    return answers


def latest_allowed_day(today: date) -> date:
    """The client sends its local date; never trust it more than a day ahead of UTC."""
    return min(today, clock.utc_today() + timedelta(days=1))


@dataclass(frozen=True)
class PendingExpense:
    expense: FixedExpense
    account_name: str
    dates: list[date]


def pending_for(db: Session, user: User, today: date) -> list[PendingExpense]:
    """Active fixed expenses with occurrences waiting for an answer, oldest first."""
    today = latest_allowed_day(today)
    balance_as_of = get_settings_for(db, user).balance_as_of
    answers = answers_by_expense(db, user)
    rows = db.execute(
        select(FixedExpense, Account.name)
        .join(Account, Account.id == FixedExpense.account_id)
        .where(FixedExpense.user_id == user.id, FixedExpense.is_active.is_(True))
    ).all()
    pending = []
    for expense, account_name in rows:
        dates = unanswered(expense, answers.get(expense.id, {}), balance_as_of, today)
        if dates:
            pending.append(PendingExpense(expense, account_name, dates))
    pending.sort(key=lambda p: (p.dates[0], p.expense.name))
    return pending


@dataclass(frozen=True)
class Answer:
    fixed_expense_id: uuid.UUID
    occurs_on: date
    paid: bool


def record_answers(db: Session, user: User, answers: list[Answer], today: date) -> None:
    """Saves each answer (a later answer for the same day replaces the earlier one)."""
    today = latest_allowed_day(today)
    balance_as_of = get_settings_for(db, user).balance_as_of
    # The same day answered twice in one request: the last answer wins
    answers = list({(a.fixed_expense_id, a.occurs_on): a for a in answers}.values())
    ids = {a.fixed_expense_id for a in answers}
    expenses = {
        e.id: e
        for e in db.scalars(
            select(FixedExpense).where(
                FixedExpense.user_id == user.id,
                FixedExpense.id.in_(ids),
                FixedExpense.is_active.is_(True),
            )
        )
    }
    if len(expenses) != len(ids):
        raise NotFoundError("No encontramos ese gasto fijo.")  # someone else's looks missing

    for answer in answers:
        expense = expenses[answer.fixed_expense_id]
        window = askable_window(expense, balance_as_of, today)
        day = Period(answer.occurs_on, answer.occurs_on)
        if window is None or answer.occurs_on not in window or not occurrences(expense, day):
            raise BusinessRuleError(
                f"«{expense.name}» no tiene un pago pendiente el {answer.occurs_on:%d/%m/%Y}."
            )

    statement = insert(FixedExpenseCheckIn).values(
        [
            {
                "user_id": user.id,
                "fixed_expense_id": a.fixed_expense_id,
                "occurs_on": a.occurs_on,
                "paid": a.paid,
            }
            for a in answers
        ]
    )
    db.execute(
        statement.on_conflict_do_update(
            index_elements=["fixed_expense_id", "occurs_on"],
            set_={"paid": statement.excluded.paid, "answered_at": datetime.now(UTC)},
        )
    )
    db.commit()
