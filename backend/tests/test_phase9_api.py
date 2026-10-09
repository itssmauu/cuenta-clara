"""API tests for savings goals, the CSV export and the new dashboard/forecast fields."""

import csv
import io
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from app.services.export import safe_cell
from tests.auth_helpers import set_primary_balance

API = "/api/v1"
WEDNESDAY = "2026-10-07"


@pytest.fixture
def ana(login_as: Callable[[str], TestClient]) -> TestClient:
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


# ── Savings goals ───────────────────────────────────────


def test_savings_goal_crud_with_plan(ana: TestClient) -> None:
    created = ana.post(
        f"{API}/savings-goals",
        json={"name": "Laptop", "target_amount": "600.00", "due_date": "2026-10-25"},
    )
    assert created.status_code == 201
    goal = created.json()
    assert (goal["saved_amount"], goal["remaining"], goal["progress_percent"]) == (
        "0.00",
        "600.00",
        0,
    )

    listed = ana.get(f"{API}/savings-goals", params={"date": WEDNESDAY}).json()
    assert listed[0]["periods_left"] == 3  # weekly user: this week + 2
    assert listed[0]["suggested_per_period"] == "200.00"

    updated = ana.put(
        f"{API}/savings-goals/{goal['id']}",
        json={"name": "Laptop nueva", "target_amount": "700.00", "saved_amount": "70.00"},
    )
    assert updated.json()["progress_percent"] == 10
    assert updated.json()["due_date"] is None

    assert ana.delete(f"{API}/savings-goals/{goal['id']}").status_code == 204
    assert ana.get(f"{API}/savings-goals").json() == []


def test_contributions_add_and_withdraw_but_never_below_zero(ana: TestClient) -> None:
    goal = ana.post(
        f"{API}/savings-goals", json={"name": "Viaje", "target_amount": "100.00"}
    ).json()
    url = f"{API}/savings-goals/{goal['id']}/contributions"

    assert ana.post(url, json={"amount": "30.00"}).json()["saved_amount"] == "30.00"
    assert ana.post(url, json={"amount": "-10.00"}).json()["saved_amount"] == "20.00"

    too_much = ana.post(url, json={"amount": "-50.00"})
    assert too_much.status_code == 422
    assert too_much.json()["detail"] == "No puedes retirar más de lo que llevas ahorrado."
    assert ana.post(url, json={"amount": "0"}).status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "X", "target_amount": "0"},
        {"name": "X", "target_amount": "10", "saved_amount": "-1"},
        {"name": "", "target_amount": "10"},
        {"name": "X", "target_amount": "10", "user_id": "00000000-0000-0000-0000-000000000000"},
    ],
)
def test_invalid_goals_are_rejected(ana: TestClient, payload: dict[str, object]) -> None:
    assert ana.post(f"{API}/savings-goals", json=payload).status_code == 422


def test_goals_are_private(login_as: Callable[[str], TestClient]) -> None:
    ana, beto = login_as("ana@example.com"), login_as("beto@example.com")
    goal = ana.post(
        f"{API}/savings-goals", json={"name": "Viaje", "target_amount": "100.00"}
    ).json()
    url = f"{API}/savings-goals/{goal['id']}"

    assert beto.get(f"{API}/savings-goals").json() == []
    assert beto.put(url, json={"name": "Mío", "target_amount": "1.00"}).status_code == 404
    assert beto.delete(url).status_code == 404
    assert beto.post(f"{url}/contributions", json={"amount": "5.00"}).status_code == 404
    assert ana.get(f"{API}/savings-goals").json()[0]["saved_amount"] == "0.00"


# ── CSV export ──────────────────────────────────────────


def parse_csv(text: str) -> list[list[str]]:
    assert text.startswith("﻿")  # BOM for Excel
    return list(csv.reader(io.StringIO(text.removeprefix("﻿"))))


def test_export_csv(ana: TestClient) -> None:
    food = next(c for c in ana.get(f"{API}/categories").json() if c["name"] == "Comida")
    ana.post(
        f"{API}/transactions",
        json={
            "type": "expense",
            "amount": "12.50",
            "category_id": food["id"],
            "occurred_on": "2026-10-06",
            "note": "Almuerzo",
        },
    )
    ana.post(
        f"{API}/transactions",
        json={"type": "income", "amount": "50.00", "occurred_on": "2026-10-04"},
    )

    response = ana.get(f"{API}/transactions/export")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert (
        'attachment; filename="cuenta-clara-movimientos-' in response.headers["content-disposition"]
    )
    assert parse_csv(response.text) == [
        ["fecha", "cuenta", "tipo", "monto", "categoria", "nota"],
        ["2026-10-06", "Cuenta principal", "gasto", "-12.50", "Comida", "Almuerzo"],
        ["2026-10-04", "Cuenta principal", "ingreso", "50.00", "", ""],
    ]


def test_export_respects_filters(ana: TestClient) -> None:
    ana.post(
        f"{API}/transactions",
        json={"type": "expense", "amount": "1.00", "occurred_on": "2026-10-01"},
    )
    ana.post(
        f"{API}/transactions",
        json={"type": "income", "amount": "2.00", "occurred_on": "2026-10-06"},
    )

    rows = parse_csv(ana.get(f"{API}/transactions/export", params={"type": "income"}).text)

    assert [r[2] for r in rows[1:]] == ["ingreso"]


def test_export_neutralizes_spreadsheet_formulas(ana: TestClient) -> None:
    ana.post(
        f"{API}/transactions",
        json={
            "type": "expense",
            "amount": "1.00",
            "occurred_on": "2026-10-06",
            "note": '=HYPERLINK("http://evil","x")',
        },
    )

    rows = parse_csv(ana.get(f"{API}/transactions/export").text)

    assert rows[1][5] == '\'=HYPERLINK("http://evil","x")'


@pytest.mark.parametrize(
    ("value", "expected"),
    [("=1+1", "'=1+1"), ("+5", "'+5"), ("@SUM", "'@SUM"), ("-2", "'-2"), ("Taxi", "Taxi")],
)
def test_safe_cell(value: str, expected: str) -> None:
    assert safe_cell(value) == expected


def test_export_only_includes_the_callers_data(login_as: Callable[[str], TestClient]) -> None:
    ana, beto = login_as("ana@example.com"), login_as("beto@example.com")
    ana.post(
        f"{API}/transactions",
        json={"type": "expense", "amount": "9.00", "occurred_on": "2026-10-06", "note": "Secreto"},
    )

    rows = parse_csv(beto.get(f"{API}/transactions/export").text)

    assert rows == [["fecha", "cuenta", "tipo", "monto", "categoria", "nota"]]


def test_export_requires_a_session(client: TestClient) -> None:
    assert client.get(f"{API}/transactions/export").status_code == 401


# ── Dashboard and forecast additions ────────────────────


def test_dashboard_reports_status_comparison_and_categories(ana: TestClient) -> None:
    food = next(c for c in ana.get(f"{API}/categories").json() if c["name"] == "Comida")
    ana.post(
        f"{API}/transactions",
        json={
            "type": "expense",
            "amount": "33.00",
            "category_id": food["id"],
            "occurred_on": "2026-10-06",
        },
    )

    body = ana.get(f"{API}/dashboard", params={"date": WEDNESDAY}).json()

    assert body["limit_used_percent"] == 83
    assert body["limit_status"] == "warning"
    assert (body["previous_period_start"], body["previous_spent"]) == ("2026-09-28", "0.00")
    assert body["spending_by_category"] == [
        {"category_id": food["id"], "name": "Comida", "color": food["color"], "amount": "33.00"}
    ]


def test_forecast_accepts_the_trend_estimator(ana: TestClient) -> None:
    trend = ana.get(f"{API}/forecast", params={"date": WEDNESDAY, "estimator": "trend"})
    bad = ana.get(f"{API}/forecast", params={"estimator": "magic"})

    assert trend.status_code == 200
    # A brand-new user has no complete weeks yet: the trend falls back to the average
    assert trend.json()["estimator"] == "average"
    assert trend.json()["history_points"] == 0
    assert bad.status_code == 422
