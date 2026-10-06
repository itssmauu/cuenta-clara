from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

URL = "/api/v1/fixed-expenses"
INTERNET = {
    "name": "Internet",
    "amount": "30.00",
    "frequency": "monthly",
    "start_date": "2026-10-01",
    "due_day": 15,
}


def test_fixed_expense_crud_with_default_category(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")
    services = next(c for c in ana.get("/api/v1/categories").json() if c["name"] == "Servicios")

    created = ana.post(URL, json={**INTERNET, "category_id": services["id"]})
    assert created.status_code == 201
    expense = created.json()
    assert expense["category_id"] == services["id"]
    assert expense["due_day"] == 15

    assert ana.get(URL).json() == [expense]

    updated = ana.put(f"{URL}/{expense['id']}", json={**INTERNET, "amount": "35.00"})
    assert updated.json()["amount"] == "35.00"
    assert updated.json()["category_id"] is None  # PUT replaces the whole record

    assert ana.delete(f"{URL}/{expense['id']}").status_code == 204
    assert ana.get(URL).json() == []


@pytest.mark.parametrize(
    "override",
    [{"due_day": 0}, {"due_day": 32}, {"amount": "0.00"}, {"name": ""}, {"user_id": None}],
)
def test_invalid_fixed_expenses_are_rejected(
    login_as: Callable[[str], TestClient], override: dict[str, object]
) -> None:
    ana = login_as("ana@example.com")

    assert ana.post(URL, json={**INTERNET, **override}).status_code == 422


def test_unknown_category_is_rejected(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")

    response = ana.post(
        URL, json={**INTERNET, "category_id": "00000000-0000-0000-0000-000000000000"}
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "La categoría no existe."
