from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.auth_helpers import set_primary_balance

API = "/api/v1"
WEDNESDAY = "2026-10-07"


@pytest.fixture
def ana(login_as: Callable[[str], TestClient]) -> TestClient:
    """Ana's onboarding: $100 on Monday 2026-10-05, weekly period, $40 weekly limit."""
    client = login_as("ana@example.com")
    client.put(
        f"{API}/settings",
        json={
            "balance_as_of": "2026-10-05",
            "income_period": "weekly",
            "spending_limit": "40.00",
            "onboarding_completed": True,
        },
    ).raise_for_status()
    set_primary_balance(client, "100.00")
    return client


def test_dashboard_spec_example(ana: TestClient) -> None:
    ana.post(
        f"{API}/incomes",
        json={
            "label": "Beca",
            "amount": "160.00",
            "frequency": "weekly",
            "start_date": "2026-10-05",
        },
    ).raise_for_status()
    ana.post(
        f"{API}/transactions",
        json={"type": "expense", "amount": "30.00", "occurred_on": "2026-10-06", "note": "Pasaje"},
    ).raise_for_status()

    response = ana.get(f"{API}/dashboard", params={"date": WEDNESDAY})

    assert response.status_code == 200
    body = response.json()
    assert body["period"] == "weekly"
    assert (body["period_start"], body["period_end"]) == ("2026-10-05", "2026-10-11")
    assert body["initial_balance"] == "100.00"
    assert body["income"] == "160.00"
    assert body["spent"] == "30.00"
    assert body["available_balance"] == "230.00"
    assert body["spending_limit"] == "40.00"
    assert body["limit_remaining"] == "10.00"
    assert body["limit_used_percent"] == 75
    assert body["over_limit"] is False
    assert len(body["series"]) == 6
    assert body["series"][-1]["spent"] == "30.00"
    assert [t["note"] for t in body["recent_transactions"]] == ["Pasaje"]


def test_dashboard_period_selector_converts_the_limit(ana: TestClient) -> None:
    body = ana.get(f"{API}/dashboard", params={"date": WEDNESDAY, "period": "daily"}).json()

    assert body["period"] == "daily"
    assert (body["period_start"], body["period_end"]) == (WEDNESDAY, WEDNESDAY)
    assert body["spending_limit"] == "5.71"  # 40 / 7


def test_dashboard_lists_upcoming_fixed_expenses(ana: TestClient) -> None:
    created = ana.post(
        f"{API}/fixed-expenses",
        json={
            "name": "Internet",
            "amount": "25.00",
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "due_day": 15,
        },
    ).json()

    upcoming = ana.get(f"{API}/dashboard", params={"date": WEDNESDAY}).json()[
        "upcoming_fixed_expenses"
    ]

    assert upcoming == [
        {
            "id": created["id"],
            "name": "Internet",
            "amount": "25.00",
            "due_on": "2026-10-15",
            "category_id": None,
        }
    ]


def test_inactive_items_do_not_count(ana: TestClient) -> None:
    ana.post(
        f"{API}/incomes",
        json={
            "label": "Pausado",
            "amount": "500.00",
            "frequency": "weekly",
            "start_date": "2026-10-05",
            "is_active": False,
        },
    )

    assert ana.get(f"{API}/dashboard", params={"date": WEDNESDAY}).json()["income"] == "0.00"


def test_forecast(ana: TestClient) -> None:
    ana.post(
        f"{API}/incomes",
        json={
            "label": "Beca",
            "amount": "160.00",
            "frequency": "weekly",
            "start_date": "2026-10-05",
        },
    )
    ana.post(
        f"{API}/fixed-expenses",
        json={
            "name": "Pasaje",
            "amount": "30.00",
            "frequency": "weekly",
            "start_date": "2026-10-05",
        },
    )

    response = ana.get(f"{API}/forecast", params={"date": WEDNESDAY, "periods": 3})

    assert response.status_code == 200
    body = response.json()
    assert body["period"] == "weekly"
    assert [p["closing_balance"] for p in body["periods"]] == ["230.00", "360.00", "490.00"]
    assert body["periods"][1]["period_start"] == "2026-10-12"


@pytest.mark.parametrize(
    "params",
    [{"periods": 0}, {"periods": 13}, {"period": "custom"}, {"period": "yearly"}, {"date": "x"}],
)
def test_forecast_rejects_bad_parameters(ana: TestClient, params: dict[str, object]) -> None:
    assert ana.get(f"{API}/forecast", params=params).status_code == 422


def test_dashboard_only_uses_the_callers_data(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")
    beto = login_as("beto@example.com")
    ana.post(
        f"{API}/transactions",
        json={"type": "income", "amount": "999.00", "occurred_on": "2026-10-06"},
    )

    body = beto.get(f"{API}/dashboard", params={"date": WEDNESDAY}).json()

    assert body["recent_transactions"] == []
    assert body["income"] == "0.00"


def test_dashboard_requires_a_session(client: TestClient) -> None:
    assert client.get(f"{API}/dashboard").status_code == 401
    assert client.get(f"{API}/forecast").status_code == 401
