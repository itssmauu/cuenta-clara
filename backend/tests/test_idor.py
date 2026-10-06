"""IDOR (Insecure Direct Object Reference): one user must never reach another user's data.

For every resource, Beto tries to read, update and delete a record that belongs to Ana
by its id. Every attempt must look exactly like the record does not exist (404), and
Ana's record must be untouched afterwards.
"""

from collections.abc import Callable
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient


@dataclass(frozen=True)
class Resource:
    url: str
    payload: dict[str, object]
    listed_under: str | None = None  # key holding the list in paginated responses


RESOURCES = {
    "income": Resource(
        "/api/v1/incomes",
        {"label": "Salario", "amount": "160.00", "frequency": "weekly", "start_date": "2026-10-01"},
    ),
    "fixed_expense": Resource(
        "/api/v1/fixed-expenses",
        {"name": "Internet", "amount": "30.00", "frequency": "monthly"},
    ),
    "transaction": Resource(
        "/api/v1/transactions",
        {"type": "expense", "amount": "30.00", "occurred_on": "2026-10-03"},
        listed_under="items",
    ),
    "category": Resource("/api/v1/categories", {"name": "Gimnasio", "color": "#5B4BDB"}),
}


@pytest.fixture
def ana_and_beto(
    login_as: Callable[[str], TestClient],
) -> tuple[TestClient, TestClient]:
    return login_as("ana@example.com"), login_as("beto@example.com")


def create_category(client: TestClient) -> dict[str, str]:
    category = RESOURCES["category"]
    return client.post(category.url, json=category.payload).json()


def _ids(client: TestClient, resource: Resource) -> list[str]:
    body = client.get(resource.url).json()
    rows = body[resource.listed_under] if resource.listed_under else body
    return [row["id"] for row in rows]


@pytest.mark.parametrize("name", RESOURCES)
def test_cannot_read_update_or_delete_another_users_record(
    ana_and_beto: tuple[TestClient, TestClient], name: str
) -> None:
    ana, beto = ana_and_beto
    resource = RESOURCES[name]
    record = ana.post(resource.url, json=resource.payload).json()
    record_url = f"{resource.url}/{record['id']}"

    if name != "category":  # categories have no single-item GET
        assert beto.get(record_url).status_code == 404
    assert beto.put(record_url, json=resource.payload).status_code == 404
    assert beto.delete(record_url).status_code == 404

    assert record["id"] not in _ids(beto, resource)
    assert record["id"] in _ids(ana, resource)  # still there, unchanged


@pytest.mark.parametrize("name", ["fixed_expense", "transaction"])
def test_cannot_attach_another_users_category(
    ana_and_beto: tuple[TestClient, TestClient], name: str
) -> None:
    ana, beto = ana_and_beto
    anas_category = create_category(ana)
    resource = RESOURCES[name]

    response = beto.post(
        resource.url, json={**resource.payload, "category_id": anas_category["id"]}
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "La categoría no existe."


def test_cannot_filter_by_another_users_category(
    ana_and_beto: tuple[TestClient, TestClient],
) -> None:
    ana, beto = ana_and_beto
    category = create_category(ana)
    ana.post(
        "/api/v1/transactions",
        json={**RESOURCES["transaction"].payload, "category_id": category["id"]},
    )

    page = beto.get("/api/v1/transactions", params={"category_id": category["id"]}).json()

    assert page["items"] == []
    assert page["total"] == 0


def test_settings_are_per_user(ana_and_beto: tuple[TestClient, TestClient]) -> None:
    ana, beto = ana_and_beto
    ana.put(
        "/api/v1/settings",
        json={"initial_balance": "100.00", "income_period": "weekly"},
    )

    assert beto.get("/api/v1/settings").json()["initial_balance"] == "0.00"


def test_client_supplied_user_id_is_rejected(ana_and_beto: tuple[TestClient, TestClient]) -> None:
    """Nobody can create a record "for" another user by sending their id."""
    ana, _ = ana_and_beto
    payload = {**RESOURCES["income"].payload, "user_id": "00000000-0000-0000-0000-000000000000"}

    assert ana.post("/api/v1/incomes", json=payload).status_code == 422
