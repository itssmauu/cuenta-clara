import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.models import SavingsGoal
from app.schemas.finance import ContributionIn, SavingsGoalIn, SavingsGoalOut
from app.services import ownership
from app.services import savings as savings_service
from app.services.dashboard import cadence_for
from app.services.settings import get_settings_for

router = APIRouter(prefix="/savings-goals", tags=["savings goals"])

DateParam = Annotated[date | None, Query(alias="date", description="Reference day; default today")]


def _out(goal: SavingsGoal, plan: savings_service.GoalPlan) -> SavingsGoalOut:
    return SavingsGoalOut(
        id=goal.id,
        name=goal.name,
        target_amount=goal.target_amount,
        saved_amount=goal.saved_amount,
        due_date=goal.due_date,
        remaining=plan.remaining,
        progress_percent=plan.progress_percent,
        completed=plan.completed,
        overdue=plan.overdue,
        periods_left=plan.periods_left,
        suggested_per_period=plan.suggested_per_period,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


def _with_plan(db: DbSession, user: CurrentUser, goal: SavingsGoal, today: date) -> SavingsGoalOut:
    settings = get_settings_for(db, user)
    cadence = cadence_for(
        settings.income_period, settings.custom_period_days, settings.balance_as_of
    )
    plan = savings_service.plan_goal(
        goal.target_amount, goal.saved_amount, goal.due_date, today, cadence
    )
    return _out(goal, plan)


@router.get("", response_model=list[SavingsGoalOut])
def list_goals(
    db: DbSession, user: CurrentUser, reference_date: DateParam = None
) -> list[SavingsGoalOut]:
    today = reference_date or date.today()
    goals = ownership.list_owned(db, SavingsGoal, user, SavingsGoal.created_at)
    return [_with_plan(db, user, goal, today) for goal in goals]


@router.post("", response_model=SavingsGoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(body: SavingsGoalIn, db: DbSession, user: CurrentUser) -> SavingsGoalOut:
    goal = ownership.create_owned(db, SavingsGoal, user, body.model_dump())
    return _with_plan(db, user, goal, date.today())


@router.put("/{goal_id}", response_model=SavingsGoalOut)
def update_goal(
    goal_id: uuid.UUID, body: SavingsGoalIn, db: DbSession, user: CurrentUser
) -> SavingsGoalOut:
    goal = ownership.get_owned(db, SavingsGoal, goal_id, user)
    return _with_plan(db, user, ownership.update_owned(db, goal, body.model_dump()), date.today())


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    ownership.delete_owned(db, ownership.get_owned(db, SavingsGoal, goal_id, user))


@router.post("/{goal_id}/contributions", response_model=SavingsGoalOut)
def contribute(
    goal_id: uuid.UUID, body: ContributionIn, db: DbSession, user: CurrentUser
) -> SavingsGoalOut:
    goal = savings_service.contribute(db, user, goal_id, body.amount)
    return _with_plan(db, user, goal, date.today())
