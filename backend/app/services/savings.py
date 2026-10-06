"""Savings goals: progress and "how much per period to get there on time"."""

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_CEILING, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SavingsGoal, User
from app.services.errors import BusinessRuleError, NotFoundError
from app.services.periods import Cadence

CENT = Decimal("0.01")


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


def contribute(db: Session, user: User, goal_id: uuid.UUID, amount: Decimal) -> SavingsGoal:
    """Add (or, with a negative amount, withdraw) money. The row is locked against races."""
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
    goal.saved_amount = new_amount
    db.commit()
    db.refresh(goal)
    return goal
