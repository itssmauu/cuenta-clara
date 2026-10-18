import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.core import clock
from app.models import SavingsGoal
from app.schemas.finance import ContributionIn, SavingsGoalIn, SavingsGoalOut
from app.services import check_ins, ownership
from app.services import savings as savings_service
from app.services.accounts import get_account
from app.services.dashboard import cadence_for
from app.services.settings import get_settings_for

router = APIRouter(prefix="/savings-goals", tags=["savings goals"])

DateParam = Annotated[date | None, Query(alias="date", description="Reference day; default today")]


def _out(
    goal: SavingsGoal, plan: savings_service.GoalPlan, pace: savings_service.SavingPace | None
) -> SavingsGoalOut:
    return SavingsGoalOut(
        id=goal.id,
        name=goal.name,
        target_amount=goal.target_amount,
        saved_amount=goal.saved_amount,
        due_date=goal.due_date,
        account_id=goal.account_id,
        remaining=plan.remaining,
        progress_percent=plan.progress_percent,
        completed=plan.completed,
        overdue=plan.overdue,
        periods_left=plan.periods_left,
        suggested_per_period=plan.suggested_per_period,
        pace_per_week=pace.per_week if pace else None,
        pace_since=pace.since if pace else None,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


def _with_plans(
    db: DbSession, user: CurrentUser, goals: list[SavingsGoal], today: date
) -> list[SavingsGoalOut]:
    settings = get_settings_for(db, user)
    cadence = cadence_for(
        settings.income_period, settings.custom_period_days, settings.balance_as_of
    )
    history = savings_service.contributions_by_goal(db, user)
    return [
        _out(
            goal,
            savings_service.plan_goal(
                goal.target_amount, goal.saved_amount, goal.due_date, today, cadence
            ),
            savings_service.saving_pace(history.get(goal.id, []), today),
        )
        for goal in goals
    ]


def _with_plan(db: DbSession, user: CurrentUser, goal: SavingsGoal, today: date) -> SavingsGoalOut:
    return _with_plans(db, user, [goal], today)[0]


@router.get("", response_model=list[SavingsGoalOut])
def list_goals(
    db: DbSession, user: CurrentUser, reference_date: DateParam = None
) -> list[SavingsGoalOut]:
    # A read: any reference day is fine (only writes keep it near the server's today)
    today = reference_date or clock.utc_today()
    goals = list(ownership.list_owned(db, SavingsGoal, user, SavingsGoal.created_at))
    return _with_plans(db, user, goals, today)


def _goal_data(db: DbSession, user: CurrentUser, body: SavingsGoalIn) -> dict[str, object]:
    data = body.model_dump()
    if data["account_id"] is None:
        data.pop("account_id")  # unlinked on create, unchanged on update
    else:
        get_account(db, user, data["account_id"])  # 404 for someone else's account
    return data


@router.post("", response_model=SavingsGoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(body: SavingsGoalIn, db: DbSession, user: CurrentUser) -> SavingsGoalOut:
    goal = ownership.create_owned(db, SavingsGoal, user, _goal_data(db, user, body))
    return _with_plan(db, user, goal, date.today())


@router.put("/{goal_id}", response_model=SavingsGoalOut)
def update_goal(
    goal_id: uuid.UUID, body: SavingsGoalIn, db: DbSession, user: CurrentUser
) -> SavingsGoalOut:
    goal = ownership.get_owned(db, SavingsGoal, goal_id, user)
    data = _goal_data(db, user, body)
    return _with_plan(db, user, ownership.update_owned(db, goal, data), date.today())


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    ownership.delete_owned(db, ownership.get_owned(db, SavingsGoal, goal_id, user))


@router.post("/{goal_id}/contributions", response_model=SavingsGoalOut)
def contribute(
    goal_id: uuid.UUID,
    body: ContributionIn,
    db: DbSession,
    user: CurrentUser,
    reference_date: DateParam = None,
) -> SavingsGoalOut:
    # Dated by the user's local day, like the transfer it may create
    today = check_ins.local_today(reference_date)
    goal = savings_service.contribute(
        db, user, goal_id, body.amount, from_account_id=body.from_account_id, today=today
    )
    return _with_plan(db, user, goal, today)
