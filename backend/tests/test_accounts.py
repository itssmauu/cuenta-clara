"""Several accounts per user: rules, balances, transfers, goals and the scoped dashboard."""

from collections.abc import Callable
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.models import Frequency
from app.services.periods import Cadence
from app.services.projections import FinanceData, Move, totals
from tests.auth_helpers import set_primary_balance

API = "/api/v1"
WEDNESDAY = "2026-10-07"


@pytest.fixture
def ana(login_as: Callable[[str], TestClient]) -> TestClient:
    """$100 in the day-to-day account on Monday 2026-10-05, weekly, $40 weekly limit."""
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


def add_account(client: TestClient, name: str, kind: str, balance: str = "0") -> dict[str, str]:
    response = client.post(
        f"{API}/accounts", json={"name": name, "kind": kind, "initial_balance": balance}
    )
    assert response.status_code == 201, response.text
    return response.json()


def balances(client: TestClient) -> dict[str, str]:
    accounts = client.get(f"{API}/accounts", params={"date": WEDNESDAY}).json()
    return {a["name"]: a["balance"] for a in accounts}


# ── Accounts ────────────────────────────────────────────


def test_every_user_starts_with_a_primary_account(login_as: Callable[[str], TestClient]) -> None:
    accounts = login_as("nuevo@example.com").get(f"{API}/accounts").json()

    assert [(a["name"], a["kind"], a["is_primary"], a["balance"]) for a in accounts] == [
        ("Cuenta principal", "spending", True, "0.00")
    ]


def test_accounts_keep_separate_balances(ana: TestClient) -> None:
    savings = add_account(ana, "Ahorro", "savings", "400.00")
    ana.post(
        f"{API}/transactions",
        json={"type": "expense", "amount": "25.00", "occurred_on": "2026-10-06"},
    ).raise_for_status()
    ana.post(
        f"{API}/incomes",
        json={
            "label": "Intereses",
            "amount": "5.00",
            "frequency": "weekly",
            "start_date": "2026-10-05",
            "account_id": savings["id"],
        },
    ).raise_for_status()

    # The expense defaulted to the primary account; the interest went to savings
    assert balances(ana) == {"Cuenta principal": "75.00", "Ahorro": "405.00"}


@pytest.mark.parametrize("name", ["0412345678901", "Cuenta 1234-5678", "4111 1111 1111 1111"])
def test_account_numbers_are_refused(ana: TestClient, name: str) -> None:
    response = ana.post(f"{API}/accounts", json={"name": name, "kind": "savings"})

    assert response.status_code == 422
    assert "números de cuenta" in response.text


def test_short_numbers_in_a_name_are_fine(ana: TestClient) -> None:
    assert add_account(ana, "Ahorro 2026", "savings")["name"] == "Ahorro 2026"


def test_account_names_are_unique(ana: TestClient) -> None:
    add_account(ana, "Ahorro", "savings")

    response = ana.post(f"{API}/accounts", json={"name": "Ahorro", "kind": "other"})
    assert response.status_code == 409


def test_at_most_ten_accounts(ana: TestClient) -> None:
    for n in range(9):  # plus the primary one = 10
        add_account(ana, f"Cuenta {chr(65 + n)}", "other")

    response = ana.post(f"{API}/accounts", json={"name": "Una más", "kind": "other"})
    assert response.status_code == 422


def test_making_another_account_primary_moves_the_role(ana: TestClient) -> None:
    other = add_account(ana, "Nueva de gastos", "spending")
    ana.put(
        f"{API}/accounts/{other['id']}",
        json={"name": "Nueva de gastos", "kind": "spending", "is_primary": True},
    ).raise_for_status()

    accounts = ana.get(f"{API}/accounts").json()
    assert [(a["name"], a["is_primary"]) for a in accounts] == [
        ("Nueva de gastos", True),
        ("Cuenta principal", False),
    ]


def test_the_primary_account_cannot_stop_being_primary_on_its_own(ana: TestClient) -> None:
    primary = ana.get(f"{API}/accounts").json()[0]

    response = ana.put(
        f"{API}/accounts/{primary['id']}",
        json={"name": primary["name"], "kind": "spending", "is_primary": False},
    )
    assert response.status_code == 422


def test_deleting_accounts(ana: TestClient) -> None:
    primary = ana.get(f"{API}/accounts").json()[0]
    unused = add_account(ana, "Vacía", "other")
    used = add_account(ana, "Usada", "savings")
    ana.post(
        f"{API}/transactions",
        json={
            "type": "income",
            "amount": "10.00",
            "occurred_on": WEDNESDAY,
            "account_id": used["id"],
        },
    ).raise_for_status()

    assert ana.delete(f"{API}/accounts/{primary['id']}").status_code == 422
    assert ana.delete(f"{API}/accounts/{used['id']}").status_code == 409
    assert ana.delete(f"{API}/accounts/{unused['id']}").status_code == 204


# ── Transfers ───────────────────────────────────────────


def test_a_transfer_moves_money_without_counting_as_spending(ana: TestClient) -> None:
    primary = ana.get(f"{API}/accounts").json()[0]
    savings = add_account(ana, "Ahorro", "savings")

    created = ana.post(
        f"{API}/transfers",
        json={
            "from_account_id": primary["id"],
            "to_account_id": savings["id"],
            "amount": "50.00",
            "occurred_on": WEDNESDAY,
        },
    )
    assert created.status_code == 201
    assert balances(ana) == {"Cuenta principal": "50.00", "Ahorro": "50.00"}

    dashboard = ana.get(f"{API}/dashboard", params={"date": WEDNESDAY}).json()
    assert (dashboard["spent"], dashboard["transfers"]) == ("0.00", "-50.00")
    assert dashboard["available_balance"] == "50.00"
    assert dashboard["limit_status"] == "ok"  # moving money is not spending it

    assert ana.delete(f"{API}/transfers/{created.json()['id']}").status_code == 204
    assert balances(ana) == {"Cuenta principal": "100.00", "Ahorro": "0.00"}


def test_a_transfer_needs_two_different_accounts(ana: TestClient) -> None:
    primary = ana.get(f"{API}/accounts").json()[0]

    response = ana.post(
        f"{API}/transfers",
        json={
            "from_account_id": primary["id"],
            "to_account_id": primary["id"],
            "amount": "5.00",
            "occurred_on": WEDNESDAY,
        },
    )
    assert response.status_code == 422


# ── Scoped dashboard and forecast ───────────────────────


def test_dashboard_opens_on_the_primary_account_and_can_switch(ana: TestClient) -> None:
    savings = add_account(ana, "Ahorro", "savings", "400.00")
    ana.post(
        f"{API}/transactions",
        json={"type": "expense", "amount": "30.00", "occurred_on": "2026-10-06"},
    ).raise_for_status()

    default = ana.get(f"{API}/dashboard", params={"date": WEDNESDAY}).json()
    assert default["account"]["name"] == "Cuenta principal"
    assert (default["available_balance"], default["spending_limit"]) == ("70.00", "40.00")

    saving = ana.get(
        f"{API}/dashboard", params={"date": WEDNESDAY, "account": savings["id"]}
    ).json()
    assert saving["account"]["name"] == "Ahorro"
    # The $400 are savings: no spending in it, and the day-to-day limit does not apply
    assert (saving["available_balance"], saving["spent"]) == ("400.00", "0.00")
    assert (saving["spending_limit"], saving["limit_status"]) == (None, "none")

    everything = ana.get(f"{API}/dashboard", params={"date": WEDNESDAY, "account": "all"}).json()
    assert everything["account"] is None
    assert (everything["initial_balance"], everything["available_balance"]) == (
        "500.00",
        "470.00",
    )


def test_forecast_can_be_scoped_to_an_account(ana: TestClient) -> None:
    savings = add_account(ana, "Ahorro", "savings", "400.00")

    forecast = ana.get(
        f"{API}/forecast", params={"date": WEDNESDAY, "account": savings["id"], "periods": 2}
    ).json()
    assert forecast["account"]["name"] == "Ahorro"
    assert [p["closing_balance"] for p in forecast["periods"]] == ["400.00", "400.00"]


def test_movements_can_be_filtered_by_account(ana: TestClient) -> None:
    savings = add_account(ana, "Ahorro", "savings")
    for account_id in (None, savings["id"]):
        ana.post(
            f"{API}/transactions",
            json={
                "type": "income",
                "amount": "10.00",
                "occurred_on": WEDNESDAY,
                "account_id": account_id,
            },
        ).raise_for_status()

    page = ana.get(f"{API}/transactions", params={"account_id": savings["id"]}).json()
    assert page["total"] == 1
    assert page["items"][0]["account_id"] == savings["id"]


def test_editing_a_movement_without_account_keeps_it(ana: TestClient) -> None:
    savings = add_account(ana, "Ahorro", "savings")
    created = ana.post(
        f"{API}/transactions",
        json={
            "type": "income",
            "amount": "10.00",
            "occurred_on": WEDNESDAY,
            "account_id": savings["id"],
        },
    ).json()

    updated = ana.put(
        f"{API}/transactions/{created['id']}",
        json={"type": "income", "amount": "12.00", "occurred_on": WEDNESDAY},
    ).json()
    assert updated["account_id"] == savings["id"]


# ── Goals linked to an account ──────────────────────────


def test_contributing_to_a_goal_moves_money_into_its_account(ana: TestClient) -> None:
    primary = ana.get(f"{API}/accounts").json()[0]
    savings = add_account(ana, "Ahorro", "savings")
    goal = ana.post(
        f"{API}/savings-goals",
        json={"name": "Laptop", "target_amount": "600.00", "account_id": savings["id"]},
    ).json()
    assert goal["account_id"] == savings["id"]

    ana.post(
        f"{API}/savings-goals/{goal['id']}/contributions",
        json={"amount": "30.00", "from_account_id": primary["id"]},
    ).raise_for_status()
    today = date.today().isoformat()
    after_deposit = {
        a["name"]: a["balance"] for a in ana.get(f"{API}/accounts", params={"date": today}).json()
    }
    assert after_deposit == {"Cuenta principal": "70.00", "Ahorro": "30.00"}

    moves = ana.get(f"{API}/transfers").json()
    assert [(m["amount"], m["goal_id"], m["note"]) for m in moves] == [
        ("30.00", goal["id"], "Aporte a la meta Laptop")
    ]

    # A withdrawal sends the money back
    ana.post(
        f"{API}/savings-goals/{goal['id']}/contributions",
        json={"amount": "-10.00", "from_account_id": primary["id"]},
    ).raise_for_status()
    after_withdrawal = {
        a["name"]: a["balance"] for a in ana.get(f"{API}/accounts", params={"date": today}).json()
    }
    assert after_withdrawal == {"Cuenta principal": "80.00", "Ahorro": "20.00"}


def test_a_contribution_without_source_only_records_it(ana: TestClient) -> None:
    savings = add_account(ana, "Ahorro", "savings")
    goal = ana.post(
        f"{API}/savings-goals",
        json={"name": "Viaje", "target_amount": "300.00", "account_id": savings["id"]},
    ).json()

    saved = ana.post(
        f"{API}/savings-goals/{goal['id']}/contributions", json={"amount": "40.00"}
    ).json()
    assert saved["saved_amount"] == "40.00"
    assert ana.get(f"{API}/transfers").json() == []


# ── Nobody can use someone else's account ───────────────


def test_another_users_account_is_invisible(
    ana: TestClient, login_as: Callable[[str], TestClient]
) -> None:
    ana_primary = ana.get(f"{API}/accounts").json()[0]["id"]
    beto = login_as("beto@example.com")
    beto_primary = beto.get(f"{API}/accounts").json()[0]["id"]

    attempts = [
        beto.get(f"{API}/dashboard", params={"account": ana_primary}),
        beto.get(f"{API}/forecast", params={"account": ana_primary}),
        beto.get(f"{API}/transactions", params={"account_id": ana_primary}),
        beto.put(
            f"{API}/accounts/{ana_primary}",
            json={"name": "Mía", "kind": "other", "is_primary": False},
        ),
        beto.delete(f"{API}/accounts/{ana_primary}"),
        beto.post(
            f"{API}/transactions",
            json={
                "type": "income",
                "amount": "1.00",
                "occurred_on": WEDNESDAY,
                "account_id": ana_primary,
            },
        ),
        beto.post(
            f"{API}/transfers",
            json={
                "from_account_id": ana_primary,
                "to_account_id": beto_primary,
                "amount": "100.00",
                "occurred_on": WEDNESDAY,
            },
        ),
        beto.post(
            f"{API}/savings-goals",
            json={"name": "X", "target_amount": "1.00", "account_id": ana_primary},
        ),
    ]
    assert [r.status_code for r in attempts] == [404] * len(attempts)
    assert balances(ana)["Cuenta principal"] == "100.00"


# ── Pure calculation ────────────────────────────────────


def test_transfers_change_the_balance_but_are_not_income_or_spending() -> None:
    monday = date(2026, 10, 5)
    data = FinanceData(
        initial_balance=Decimal("100.00"),
        balance_as_of=monday,
        spending_limit=None,
        limit_cadence=Cadence(Frequency.WEEKLY),
        moves=[Move(monday, Decimal("-50.00")), Move(monday, Decimal("20.00"))],
    )
    week = data.limit_cadence.containing(monday)

    result = totals(data, week)
    assert (result.income, result.spent, result.transfers, result.net) == (
        Decimal("0.00"),
        Decimal("0.00"),
        Decimal("-30.00"),
        Decimal("-30.00"),
    )
