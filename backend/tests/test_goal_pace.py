"""Saving pace of a goal: how much the user puts into it per week, from their history."""

from collections.abc import Callable
from datetime import date
from decimal import Decimal

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.database import get_sessionmaker
from app.models import GoalContribution, User
from app.services.assistant import build_context
from app.services.savings import saving_pace
from tests.auth_helpers import set_primary_balance

API = "/api/v1"
D = Decimal


def day(n: int) -> date:
    """Day n of October 2026."""
    return date(2026, 10, n)


# ── The pace itself ─────────────────────────────────────


def test_pace_counts_what_came_after_the_first_contribution() -> None:
    # $25 on the 1st, 8th and 15th: from the 1st to the 15th, $50 in 14 days
    history = [(day(1), D("25")), (day(8), D("25")), (day(15), D("25"))]

    pace = saving_pace(history, day(15))

    assert pace is not None
    assert (pace.per_week, pace.since) == (D("25.00"), day(1))


def test_stopping_lowers_the_pace_day_by_day() -> None:
    history = [(day(1), D("25")), (day(8), D("25"))]

    assert saving_pace(history, day(8)).per_week == D("25.00")  # type: ignore[union-attr]
    assert saving_pace(history, day(15)).per_week == D("12.50")  # type: ignore[union-attr]


def test_withdrawals_count_against_the_pace() -> None:
    history = [(day(1), D("100")), (day(8), D("-30"))]

    assert saving_pace(history, day(8)).per_week == D("-30.00")  # type: ignore[union-attr]


@pytest.mark.parametrize(
    "history",
    [
        [],
        [(day(1), D("50"))],  # a single contribution says nothing about how often
        [(day(1), D("20")), (day(1), D("30"))],  # two, but on the same day
        [(day(10), D("20")), (day(12), D("20"))],  # less than a week since the first
    ],
)
def test_no_pace_with_too_little_history(history: list[tuple[date, Decimal]]) -> None:
    assert saving_pace(history, day(14)) is None


def test_old_contributions_fade_out() -> None:
    # A burst in January, then nothing: by October it no longer sets the pace
    history = [(date(2026, 1, 5), D("500")), (date(2026, 1, 12), D("500"))]

    assert saving_pace(history, day(15)) is None


# ── Through the API ─────────────────────────────────────


@pytest.fixture
def ana(login_as: Callable[[str], TestClient]) -> TestClient:
    client = login_as("ana@example.com")
    client.put(
        f"{API}/settings",
        json={
            "balance_as_of": "2026-10-01",
            "income_period": "weekly",
            "onboarding_completed": True,
        },
    ).raise_for_status()
    set_primary_balance(client, "500.00")
    return client


def test_each_contribution_is_dated_and_sets_the_pace(
    ana: TestClient, utc_today: Callable[[date], None]
) -> None:
    goal = ana.post(
        f"{API}/savings-goals", json={"name": "Laptop", "target_amount": "600.00"}
    ).json()
    assert (goal["pace_per_week"], goal["pace_since"]) == (None, None)
    url = f"{API}/savings-goals/{goal['id']}/contributions"

    for n in (1, 8, 15):
        utc_today(day(n))
        ana.post(url, json={"amount": "25.00"}).raise_for_status()

    listed = ana.get(f"{API}/savings-goals", params={"date": "2026-10-15"}).json()[0]
    assert listed["saved_amount"] == "75.00"
    assert (listed["pace_per_week"], listed["pace_since"]) == ("25.00", "2026-10-01")


def test_the_local_day_dates_the_contribution(
    ana: TestClient, utc_today: Callable[[date], None]
) -> None:
    goal = ana.post(f"{API}/savings-goals", json={"name": "Viaje", "target_amount": "300"}).json()
    utc_today(day(13))  # 8 p.m. on the 12th in Panama is already the 13th in UTC

    ana.post(
        f"{API}/savings-goals/{goal['id']}/contributions",
        params={"date": "2026-10-12"},
        json={"amount": "10.00"},
    ).raise_for_status()

    with get_sessionmaker()() as session:
        days = session.scalars(select(GoalContribution.occurred_on)).all()
    assert days == [day(12)]


def test_another_users_contributions_do_not_count(
    login_as: Callable[[str], TestClient], utc_today: Callable[[date], None]
) -> None:
    beto = login_as("beto@example.com")
    goal = beto.post(f"{API}/savings-goals", json={"name": "Moto", "target_amount": "900"}).json()
    for n in (1, 15):
        utc_today(day(n))
        beto.post(
            f"{API}/savings-goals/{goal['id']}/contributions", json={"amount": "40.00"}
        ).raise_for_status()

    ana = login_as("ana@example.com")
    ana.post(f"{API}/savings-goals", json={"name": "Laptop", "target_amount": "600"})

    mine = ana.get(f"{API}/savings-goals", params={"date": "2026-10-15"}).json()
    assert [g["pace_per_week"] for g in mine] == [None]


def test_contributions_that_moved_money_seed_the_history(
    ana: TestClient, utc_today: Callable[[date], None], alembic_config: Config
) -> None:
    savings = ana.post(
        f"{API}/accounts", json={"name": "Ahorro", "kind": "savings", "initial_balance": "0"}
    ).json()
    main = next(a for a in ana.get(f"{API}/accounts").json() if a["is_primary"])
    goal = ana.post(
        f"{API}/savings-goals",
        json={"name": "Laptop", "target_amount": "600", "account_id": savings["id"]},
    ).json()
    url = f"{API}/savings-goals/{goal['id']}/contributions"
    for n, amount in ((1, "50.00"), (8, "30.00"), (15, "-20.00")):
        utc_today(day(n))
        ana.post(url, json={"amount": amount, "from_account_id": main["id"]}).raise_for_status()

    # As if they were made before this history existed: only the transfers are left
    with get_sessionmaker()() as session:
        session.execute(delete(GoalContribution))
        session.commit()
    command.downgrade(alembic_config, "7c1d2e3f4a5b")
    command.upgrade(alembic_config, "head")

    with get_sessionmaker()() as session:
        rows = session.execute(
            select(GoalContribution.occurred_on, GoalContribution.amount).order_by(
                GoalContribution.occurred_on
            )
        ).all()
    assert [(on, str(amount)) for on, amount in rows] == [
        (day(1), "50.00"),
        (day(8), "30.00"),
        (day(15), "-20.00"),
    ]


def test_balbo_knows_the_pace_of_a_goal_without_a_date(
    ana: TestClient, utc_today: Callable[[date], None]
) -> None:
    goal = ana.post(f"{API}/savings-goals", json={"name": "Laptop", "target_amount": "600"}).json()
    for n in (1, 8, 15):
        utc_today(day(n))
        ana.post(
            f"{API}/savings-goals/{goal['id']}/contributions", json={"amount": "25.00"}
        ).raise_for_status()

    with get_sessionmaker()() as session:
        user = session.scalars(select(User).where(User.email == "ana@example.com")).one()
        context = build_context(session, user, day(15))

    # $525 left at $25 a week
    assert "Laptop: $75.00 de $600.00, su ritmo reciente es $25.00 por semana" in context
    assert "le faltan unas 21 semanas" in context
