"""Savings goals: progress, "how much per period to get there on time" and saving pace."""

import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_CEILING, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import GoalContribution, SavingsGoal, User
from app.services.accounts import get_account
from app.services.errors import BusinessRuleError, NotFoundError
from app.services.periods import Cadence
from app.services.transfers import create_transfer

CENT = Decimal("0.01")
# The pace looks at this much recent history, so old habits fade out
PACE_WINDOW_DAYS = 182
# Fewer days than this since the first contribution is too little to tell a pace
PACE_MIN_DAYS = 7


@dataclass(frozen=True)
class GoalPlan:
    remaining: Decimal
    progress_percent: int
    completed: bool
    overdue: bool
    # Periods left counting the current one; None without a due date
    periods_left: int | None
    # What to save each period to reach the goal by the due date (rounded up to the cent)
    suggested_per_period: Decimal | None


def plan_goal(
    target: Decimal, saved: Decimal, due_date: date | None, today: date, cadence: Cadence
) -> GoalPlan:
    remaining = max(target - saved, Decimal(0)).quantize(CENT)
    progress = int(min(saved / target * 100, Decimal(999)).to_integral_value()) if target else 0
    completed = remaining == 0
    if due_date is None or completed:
        return GoalPlan(remaining, progress, completed, False, None, None)
    if due_date < today:
        return GoalPlan(remaining, progress, completed, True, 0, None)

    # Count periods from the current one up to (and including) the one holding the due date
    periods, period = 1, cadence.containing(today)
    last = cadence.containing(due_date)
    while period != last:
        period = cadence.next(period)
        periods += 1
    per_period = (remaining / periods).quantize(CENT, rounding=ROUND_CEILING)
    return GoalPlan(remaining, progress, completed, False, periods, per_period)


@dataclass(frozen=True)
class SavingPace:
    # Average net amount put into the goal per week (negative: money is leaving it)
    per_week: Decimal
    # The first contribution the pace is measured from
    since: date


def saving_pace(contributions: Iterable[tuple[date, Decimal]], today: date) -> SavingPace | None:
    """How much the user puts into a goal per week, from their recent contributions.

    Measured from the first contribution of the last ~6 months until today: what came
    after that first one, divided by the days elapsed. The first is the starting point,
    not part of the pace (one deposit today says nothing about how often they save).
    Stopping lowers the pace day by day, as it should. None until there are
    contributions on two different days and at least a week since the first.
    """
    start = today - timedelta(days=PACE_WINDOW_DAYS)
    recent = sorted((on, amount) for on, amount in contributions if start <= on <= today)
    if len({on for on, _ in recent}) < 2:
        return None
    first = recent[0][0]
    days = (today - first).days
    if days < PACE_MIN_DAYS:
        return None
    after_first = sum((amount for on, amount in recent if on > first), Decimal(0))
    return SavingPace((after_first * 7 / days).quantize(CENT), first)


def contributions_by_goal(db: Session, user: User) -> dict[uuid.UUID, list[tuple[date, Decimal]]]:
    """Every goal's contributions, (day, amount), for all of the user's goals at once."""
    rows = db.execute(
        select(GoalContribution.goal_id, GoalContribution.occurred_on, GoalContribution.amount)
        .where(GoalContribution.user_id == user.id)
        .order_by(GoalContribution.occurred_on)
    )
    result: dict[uuid.UUID, list[tuple[date, Decimal]]] = {}
    for goal_id, on, amount in rows:
        result.setdefault(goal_id, []).append((on, amount))
    return result


def contribute(
    db: Session,
    user: User,
    goal_id: uuid.UUID,
    amount: Decimal,
    *,
    from_account_id: uuid.UUID | None = None,
    today: date | None = None,
) -> SavingsGoal:
    """Add (or, with a negative amount, withdraw) money. The row is locked against races.

    When the goal lives in an account and another account is given, the money really
    moves: a deposit is a transfer from that account into the goal's account, and a
    withdrawal sends it back. Both happen in one transaction with the new saved amount.
    """
    goal = db.scalar(
        select(SavingsGoal)
        .where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user.id)
        .with_for_update()
    )
    if goal is None:
        raise NotFoundError
    new_amount = goal.saved_amount + amount
    if new_amount < 0:
        db.rollback()
        raise BusinessRuleError("No puedes retirar más de lo que llevas ahorrado.")
    if from_account_id is not None:
        get_account(db, user, from_account_id)  # 404 for someone else's account
    if goal.account_id is not None and from_account_id not in (None, goal.account_id):
        deposit = amount > 0
        create_transfer(
            db,
            user,
            from_account_id=from_account_id if deposit else goal.account_id,
            to_account_id=goal.account_id if deposit else from_account_id,
            amount=abs(amount),
            occurred_on=today or date.today(),
            note=f"{'Aporte a' if deposit else 'Retiro de'} la meta {goal.name}",
            goal_id=goal.id,
            commit=False,
        )
    goal.saved_amount = new_amount
    # The history behind the saving pace
    db.add(
        GoalContribution(
            user_id=user.id, goal_id=goal.id, amount=amount, occurred_on=today or date.today()
        )
    )
    db.commit()
    db.refresh(goal)
    return goal
