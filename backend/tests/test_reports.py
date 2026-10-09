"""The movements report: what it includes, its filters, and both file formats."""

import csv
import io
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.auth_helpers import set_primary_balance

API = "/api/v1"
URL = f"{API}/reports/export"
SUNDAY = "2026-10-11"


@pytest.fixture
def ana(login_as: Callable[[str], TestClient]) -> TestClient:
    """Weekly, tracking since Monday 2026-10-05: grant +160, bus -30, lunch -12.50."""
    client = login_as("ana@example.com")
    client.put(
        f"{API}/settings",
        json={
            "balance_as_of": "2026-10-05",
            "income_period": "weekly",
            "onboarding_completed": True,
        },
    ).raise_for_status()
    set_primary_balance(client, "100.00")
    food = next(c for c in client.get(f"{API}/categories").json() if c["name"] == "Comida")
    for path, body in [
        (
            "incomes",
            {
                "label": "Beca",
                "amount": "160.00",
                "frequency": "weekly",
                "start_date": "2026-10-05",
            },
        ),
        (
            "fixed-expenses",
            {
                "name": "Pasaje",
                "amount": "30.00",
                "frequency": "weekly",
                "start_date": "2026-10-05",
            },
        ),
        (
            "transactions",
            {
                "type": "expense",
                "amount": "12.50",
                "occurred_on": "2026-10-06",
                "note": "Almuerzo",
                "category_id": food["id"],
            },
        ),
    ]:
        client.post(f"{API}/{path}", json=body).raise_for_status()
    return client


def with_savings_transfer(client: TestClient) -> str:
    """Adds an 'Ahorro' account and moves $50 into it on Wednesday; returns its id."""
    primary = client.get(f"{API}/accounts").json()[0]
    savings = client.post(f"{API}/accounts", json={"name": "Ahorro", "kind": "savings"}).json()
    client.post(
        f"{API}/transfers",
        json={
            "from_account_id": primary["id"],
            "to_account_id": savings["id"],
            "amount": "50.00",
            "occurred_on": "2026-10-07",
        },
    ).raise_for_status()
    return savings["id"]


def rows(response_text: str) -> list[list[str]]:
    return list(csv.reader(io.StringIO(response_text.lstrip("﻿"))))


def test_the_csv_includes_recurring_items_movements_and_transfers(ana: TestClient) -> None:
    with_savings_transfer(ana)

    response = ana.get(URL, params={"to": SUNDAY})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert (
        'filename="cuenta-clara-reporte-2026-10-05-a-2026-10-11.csv"'
        in (response.headers["content-disposition"])
    )
    # Empty "from": since the day tracking started. Recurring items appear on each date.
    assert rows(response.text) == [
        ["fecha", "cuenta", "tipo", "concepto", "categoria", "monto", "nota"],
        ["2026-10-05", "Cuenta principal", "Gasto fijo", "Pasaje", "", "-30.00", ""],
        ["2026-10-05", "Cuenta principal", "Ingreso fijo", "Beca", "", "160.00", ""],
        ["2026-10-06", "Cuenta principal", "Gasto", "Almuerzo", "Comida", "-12.50", "Almuerzo"],
        [
            "2026-10-07",
            "Cuenta principal",
            "Transferencia",
            "Cuenta principal → Ahorro",
            "",
            "-50.00",
            "",
        ],
    ]


def test_the_report_can_show_only_expenses(ana: TestClient) -> None:
    with_savings_transfer(ana)

    body = rows(ana.get(URL, params={"to": SUNDAY, "type": "expense"}).text)

    assert [(r[2], r[5]) for r in body[1:]] == [("Gasto fijo", "-30.00"), ("Gasto", "-12.50")]


def test_a_two_week_range_repeats_the_weekly_items(ana: TestClient) -> None:
    body = rows(ana.get(URL, params={"from": "2026-10-05", "to": "2026-10-18"}).text)

    assert [r[0] for r in body[1:] if r[3] == "Beca"] == ["2026-10-05", "2026-10-12"]


def test_per_account_and_all_accounts(ana: TestClient) -> None:
    savings_id = with_savings_transfer(ana)

    saving = rows(ana.get(URL, params={"to": SUNDAY, "account": savings_id}).text)
    assert saving[1:] == [
        ["2026-10-07", "Ahorro", "Transferencia", "Cuenta principal → Ahorro", "", "50.00", ""]
    ]

    everything = rows(ana.get(URL, params={"to": SUNDAY, "account": "all"}).text)
    transfer = next(r for r in everything if r[2] == "Transferencia")
    # Between two of the user's accounts: counts as 0, the note says how much moved
    assert (transfer[5], transfer[6]) == ("0.00", "Entre tus cuentas: 50.00")


def test_the_pdf_is_a_real_pdf(ana: TestClient) -> None:
    with_savings_transfer(ana)

    response = ana.get(URL, params={"to": SUNDAY, "format": "pdf"})

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].endswith('.pdf"')
    assert response.content.startswith(b"%PDF-")
    assert response.content.rstrip().endswith(b"%%EOF")


def test_the_pdf_handles_accents_emoji_and_an_empty_range(ana: TestClient) -> None:
    ana.post(
        f"{API}/transactions",
        json={
            "type": "expense",
            "amount": "3.00",
            "occurred_on": "2026-10-08",
            "note": "Café con ñandú ☕ – “promo”",
        },
    ).raise_for_status()

    assert ana.get(URL, params={"to": SUNDAY, "format": "pdf"}).status_code == 200
    empty = ana.get(URL, params={"from": "2026-12-01", "to": "2026-12-02", "format": "pdf"})
    assert empty.content.startswith(b"%PDF-")


def test_spreadsheet_formulas_are_neutralized(ana: TestClient) -> None:
    ana.post(
        f"{API}/transactions",
        json={"type": "expense", "amount": "1.00", "occurred_on": "2026-10-08", "note": "=1+1"},
    ).raise_for_status()

    body = rows(ana.get(URL, params={"to": SUNDAY}).text)
    note_row = next(r for r in body if r[6].endswith("1+1"))
    assert (note_row[3], note_row[6]) == ("'=1+1", "'=1+1")


@pytest.mark.parametrize(
    "params",
    [
        {"from": "2026-10-10", "to": "2026-10-01"},  # backwards
        {"from": "2020-01-01", "to": "2026-01-01"},  # more than three years
        {"format": "xlsx"},
    ],
)
def test_bad_ranges_and_formats_are_refused(ana: TestClient, params: dict[str, str]) -> None:
    assert ana.get(URL, params=params).status_code == 422


def test_only_the_callers_data_and_accounts(
    ana: TestClient, login_as: Callable[[str], TestClient]
) -> None:
    ana_primary = ana.get(f"{API}/accounts").json()[0]["id"]
    beto = login_as("beto@example.com")

    assert beto.get(URL, params={"account": ana_primary}).status_code == 404
    assert rows(beto.get(URL, params={"to": SUNDAY}).text)[1:] == []


def test_requires_a_session(client: TestClient) -> None:
    assert client.get(URL).status_code == 401
