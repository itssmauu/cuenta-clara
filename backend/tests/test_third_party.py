"""Someone else's money: it moves the balance but is never income or spending."""

import csv
import io
from collections.abc import Callable
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import get_sessionmaker
from app.models import User
from app.services.assistant import build_context
from tests.auth_helpers import set_primary_balance

API = "/api/v1"
URL = f"{API}/transactions"
WEDNESDAY = "2026-10-07"


@pytest.fixture
def ana(login_as: Callable[[str], TestClient]) -> TestClient:
    """$100 on Monday 2026-10-05, weekly, $40 limit; $30 bus fare spent on Tuesday."""
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
    client.post(
        URL, json={"type": "expense", "amount": "30.00", "occurred_on": "2026-10-06"}
    ).raise_for_status()
    return client


def third_party(client: TestClient, kind: str, amount: str, **extra: object) -> dict[str, object]:
    response = client.post(
        URL,
        json={
            "type": kind,
            "amount": amount,
            "occurred_on": WEDNESDAY,
            "third_party": True,
            **extra,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_money_for_someone_else_moves_the_balance_only(ana: TestClient) -> None:
    # Mom sends $50 to pay the electricity bill, and Ana pays $45 of it
    received = third_party(ana, "income", "50.00", note="Luz de mamá")
    third_party(ana, "expense", "45.00", note="Pagué la luz")
    assert received["third_party"] is True

    body = ana.get(f"{API}/dashboard", params={"date": WEDNESDAY}).json()

    assert body["income"] == "0.00"  # not Ana's income
    assert body["spent"] == "30.00"  # the bill is not Ana's spending
    assert body["limit_remaining"] == "10.00"
    assert body["third_party"] == "5.00"
    assert body["available_balance"] == "75.00"  # 100 − 30 + 50 − 45
    assert body["spending_by_category"] == [
        {"category_id": None, "name": "Sin categoría", "color": None, "amount": "30.00"}
    ]
    assert ana.get(f"{URL}/third-party-balance").json() == {"balance": "5.00"}


def test_an_occasional_income_is_the_users_own(ana: TestClient) -> None:
    ana.post(
        URL,
        json={"type": "income", "amount": "20.00", "occurred_on": WEDNESDAY, "note": "Papá"},
    ).raise_for_status()

    body = ana.get(f"{API}/dashboard", params={"date": WEDNESDAY}).json()

    assert body["income"] == "20.00"
    assert body["third_party"] == "0.00"
    assert ana.get(f"{URL}/third-party-balance").json() == {"balance": "0.00"}


def test_paying_more_than_received_shows_a_negative_balance(ana: TestClient) -> None:
    third_party(ana, "expense", "12.00")

    assert ana.get(f"{URL}/third-party-balance").json() == {"balance": "-12.00"}


def test_someone_elses_money_has_no_category(ana: TestClient) -> None:
    food = next(c for c in ana.get(f"{API}/categories").json() if c["name"] == "Comida")

    created = third_party(ana, "expense", "8.00", category_id=food["id"])

    assert created["category_id"] is None


def test_the_list_can_show_only_own_or_only_others_money(ana: TestClient) -> None:
    third_party(ana, "income", "50.00")

    def amounts(**params: str) -> list[str]:
        return sorted(t["amount"] for t in ana.get(URL, params=params).json()["items"])

    assert amounts(third_party="true") == ["50.00"]
    assert amounts(third_party="false") == ["30.00"]
    assert amounts() == ["30.00", "50.00"]


def test_the_forecast_counts_it_in_the_balance(ana: TestClient) -> None:
    third_party(ana, "income", "50.00")

    forecast = ana.get(f"{API}/forecast", params={"date": WEDNESDAY, "periods": 2}).json()

    current = forecast["periods"][0]
    assert current["income"] == "0.00"
    assert current["closing_balance"] == "120.00"  # 100 − 30 + 50


def test_reports_and_exports_label_it(ana: TestClient) -> None:
    third_party(ana, "income", "50.00", note="Luz de mamá")

    report = ana.get(
        f"{API}/reports/export",
        params={"format": "csv", "from": "2026-10-05", "to": "2026-10-11"},
    )
    assert report.status_code == 200
    assert "De terceros" in report.text and "Luz de mamá" in report.text

    only_income = ana.get(
        f"{API}/reports/export",
        params={"format": "csv", "from": "2026-10-05", "to": "2026-10-11", "type": "income"},
    )
    assert "Luz de mamá" not in only_income.text  # it is not income

    export = ana.get(f"{URL}/export").text.lstrip("﻿")
    kinds = [row["tipo"] for row in csv.DictReader(io.StringIO(export))]
    assert sorted(kinds) == ["gasto", "recibido de terceros"]


def test_balbo_knows_that_money_is_not_the_users(ana: TestClient) -> None:
    third_party(ana, "income", "50.00")
    with get_sessionmaker()() as session:
        user = session.scalars(select(User).where(User.email == "ana@example.com")).one()
        context = build_context(session, user, date(2026, 10, 7))

    assert "$50.00 es dinero de terceros" in context
