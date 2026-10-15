"""Budgets per category through the API: CRUD, summary, scope, ownership and limits."""

from collections.abc import Callable
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.auth_helpers import set_primary_balance
from tests.test_assistant import FakeModel, use_model

API = "/api/v1"
WEDNESDAY = "2026-10-07"


@pytest.fixture
def ana(login_as: Callable[[str], TestClient]) -> TestClient:
    """$100 from Monday 2026-10-05, weekly period, $100 weekly spending limit."""
    client = login_as("ana@example.com")
    client.put(
        f"{API}/settings",
        json={
            "balance_as_of": "2026-10-05",
            "income_period": "weekly",
            "spending_limit": "100.00",
            "onboarding_completed": True,
        },
    ).raise_for_status()
    set_primary_balance(client, "100.00")
    return client


def category_id(client: TestClient, name: str) -> str:
    return str(next(c["id"] for c in client.get(f"{API}/categories").json() if c["name"] == name))


def spend(client: TestClient, amount: str, category: str | None, **extra: Any) -> None:
    client.post(
        f"{API}/transactions",
        json={
            "type": "expense",
            "amount": amount,
            "occurred_on": WEDNESDAY,
            "category_id": category,
        }
        | extra,
    ).raise_for_status()


def budgets(client: TestClient, **params: str) -> dict[str, Any]:
    response = client.get(f"{API}/budgets", params={"date": WEDNESDAY, **params})
    assert response.status_code == 200, response.text
    return dict(response.json())


def row_for(summary: dict[str, Any], category: str) -> dict[str, Any]:
    return dict(next(r for r in summary["rows"] if r["category_id"] == category))


# ── Create, change, remove ──────────────────────────────


def test_a_budget_can_be_set_changed_and_removed(ana: TestClient) -> None:
    food = category_id(ana, "Comida")

    created = ana.put(f"{API}/budgets/{food}", json={"amount": "40.00"})
    assert created.status_code == 200
    assert created.json() == {"category_id": food, "amount": "40.00", "income_period": "weekly"}
    assert row_for(budgets(ana), food)["budget"] == "40.00"

    ana.put(f"{API}/budgets/{food}", json={"amount": "55.50"}).raise_for_status()
    assert row_for(budgets(ana), food)["amount"] == "55.50"

    assert ana.delete(f"{API}/budgets/{food}").status_code == 204
    assert row_for(budgets(ana), food)["status"] == "none"
    assert ana.delete(f"{API}/budgets/{food}").status_code == 204  # nothing left: still fine


def test_the_summary_shows_spent_remaining_and_status(ana: TestClient) -> None:
    food = category_id(ana, "Comida")
    ana.put(f"{API}/budgets/{food}", json={"amount": "40.00"}).raise_for_status()
    spend(ana, "35.00", food)
    spend(ana, "6.00", None)  # uncategorized

    summary = budgets(ana)

    assert summary["period"] == {"start": "2026-10-05", "end": "2026-10-11", "type": "weekly"}
    assert row_for(summary, food) == {
        "category_id": food,
        "name": "Comida",
        "amount": "40.00",
        "budget": "40.00",
        "spent": "35.00",
        "remaining": "5.00",
        "percent": "87.50",
        "status": "warning",
    }
    assert summary["unbudgeted_spent"] == "6.00"
    assert summary["totals"] == {"budgeted": "40.00", "spent": "35.00", "remaining": "5.00"}
    assert (summary["spending_limit"], summary["unassigned"]) == ("100.00", "60.00")
    assert summary["over_limit_warning"] is False


def test_another_period_converts_the_budget(ana: TestClient) -> None:
    food = category_id(ana, "Comida")
    ana.put(f"{API}/budgets/{food}", json={"amount": "70.00"}).raise_for_status()

    summary = budgets(ana, period="monthly")

    assert row_for(summary, food)["budget"] == "304.38"  # 70 × 30.4375 / 7
    assert summary["period"]["type"] == "monthly"
    assert summary["income_period"] == "weekly"


def test_budgets_above_the_limit_are_flagged(ana: TestClient) -> None:
    ana.put(
        f"{API}/budgets/{category_id(ana, 'Comida')}", json={"amount": "80.00"}
    ).raise_for_status()
    ana.put(
        f"{API}/budgets/{category_id(ana, 'Transporte')}", json={"amount": "40.00"}
    ).raise_for_status()

    summary = budgets(ana)

    assert (summary["unassigned"], summary["over_limit_warning"]) == ("-20.00", True)


def test_spending_is_counted_within_the_account_scope(ana: TestClient) -> None:
    food = category_id(ana, "Comida")
    ana.put(f"{API}/budgets/{food}", json={"amount": "40.00"}).raise_for_status()
    savings = ana.post(
        f"{API}/accounts", json={"name": "Ahorro", "kind": "savings", "initial_balance": "300.00"}
    ).json()
    spend(ana, "10.00", food)
    spend(ana, "25.00", food, account_id=savings["id"])

    assert row_for(budgets(ana), food)["spent"] == "10.00"  # the primary account
    assert row_for(budgets(ana, account="all"), food)["spent"] == "35.00"
    # The spending limit belongs to the day-to-day account: not to the savings one
    assert budgets(ana, account=savings["id"])["over_limit_warning"] is None


def test_a_users_own_category_can_have_a_budget_and_takes_it_along(ana: TestClient) -> None:
    gym = ana.post(f"{API}/categories", json={"name": "Gimnasio", "color": "#0F7A57"}).json()
    ana.put(f"{API}/budgets/{gym['id']}", json={"amount": "25.00"}).raise_for_status()

    ana.delete(f"{API}/categories/{gym['id']}").raise_for_status()

    assert all(r["category_id"] != gym["id"] for r in budgets(ana)["rows"])
    assert ana.get(f"{API}/me/export").json()["presupuestos_por_categoria"] == []


def test_budgets_are_part_of_the_data_export(ana: TestClient) -> None:
    food = category_id(ana, "Comida")
    ana.put(f"{API}/budgets/{food}", json={"amount": "40.00"}).raise_for_status()

    [exported] = ana.get(f"{API}/me/export").json()["presupuestos_por_categoria"]

    assert (exported["category_id"], exported["amount"]) == (food, "40.00")
    assert "user_id" not in exported


# ── Suggestions ─────────────────────────────────────────


def test_suggestions_start_from_what_was_spent(ana: TestClient) -> None:
    food = category_id(ana, "Comida")
    spend(ana, "18.00", food)

    response = ana.get(f"{API}/budgets/suggestions", params={"date": WEDNESDAY})

    assert response.status_code == 200
    assert response.json() == {
        "period": "weekly",
        "based_on_periods": 0,
        "suggestions": [{"category_id": food, "name": "Comida", "amount": "18.00"}],
    }


# ── Ownership, validation and session ───────────────────


def test_someone_elses_category_looks_missing(
    ana: TestClient, login_as: Callable[[str], TestClient]
) -> None:
    beto = login_as("beto@example.com")
    private = beto.post(f"{API}/categories", json={"name": "Secreto", "color": "#FF7A59"}).json()

    for response in (
        ana.put(f"{API}/budgets/{private['id']}", json={"amount": "10.00"}),
        ana.delete(f"{API}/budgets/{private['id']}"),
    ):
        assert response.status_code == 404
    assert all(r["name"] != "Secreto" for r in budgets(ana)["rows"])


def test_budgets_are_per_user(ana: TestClient, login_as: Callable[[str], TestClient]) -> None:
    food = category_id(ana, "Comida")
    ana.put(f"{API}/budgets/{food}", json={"amount": "40.00"}).raise_for_status()

    beto = login_as("beto@example.com")

    assert row_for(budgets(beto), food)["status"] == "none"


@pytest.mark.parametrize(
    "body",
    [
        {"amount": "0"},
        {"amount": "-5.00"},
        {"amount": "1000000.01"},
        {"amount": "10.001"},
        {"amount": "10.00", "user_id": "00000000-0000-0000-0000-000000000000"},
        {},
    ],
)
def test_invalid_amounts_are_rejected(ana: TestClient, body: dict[str, str]) -> None:
    food = category_id(ana, "Comida")

    assert ana.put(f"{API}/budgets/{food}", json=body).status_code == 422


def test_budgets_need_a_session_and_csrf(ana: TestClient, client: TestClient) -> None:
    food = category_id(ana, "Comida")
    assert client.get(f"{API}/budgets").status_code == 401
    assert client.get(f"{API}/budgets/suggestions").status_code == 401

    del ana.headers["X-CSRF-Token"]
    assert ana.put(f"{API}/budgets/{food}", json={"amount": "10.00"}).status_code == 403
    assert ana.delete(f"{API}/budgets/{food}").status_code == 403


# ── Balbo knows about them ──────────────────────────────


def test_balbo_sees_the_budgets_and_their_state(ana: TestClient) -> None:
    food = category_id(ana, "Comida")
    ana.put(f"{API}/budgets/{food}", json={"amount": "40.00"}).raise_for_status()
    # Balbo looks at the real "today", so the spending has to be in this week
    spend(ana, "35.00", food, occurred_on=date.today().isoformat())
    model = FakeModel()
    use_model(model)
    ana.post(f"{API}/assistant/consent").raise_for_status()

    ana.post(
        f"{API}/assistant/chat",
        json={"messages": [{"role": "user", "content": "¿Cómo voy?"}]},
    ).raise_for_status()

    _, prompt = model.calls[0]
    assert "Presupuestos por categoría" in prompt
    assert "Comida: $35.00 de $40.00 (87.50%, cerca del tope)" in prompt
