from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

URL = "/api/v1/incomes"
SALARY = {"label": "Salario", "amount": "160.00", "frequency": "weekly", "start_date": "2026-10-01"}


def test_income_crud(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")

    created = ana.post(URL, json=SALARY)
    assert created.status_code == 201
    income = created.json()
    assert income["amount"] == "160.00"
    assert income["is_active"] is True

    assert ana.get(f"{URL}/{income['id']}").json() == income
    assert ana.get(URL).json() == [income]

    updated = ana.put(f"{URL}/{income['id']}", json={**SALARY, "amount": 175.5, "is_active": False})
    assert updated.status_code == 200
    assert updated.json()["amount"] == "175.50"
    assert updated.json()["is_active"] is False

    assert ana.delete(f"{URL}/{income['id']}").status_code == 204
    assert ana.get(f"{URL}/{income['id']}").status_code == 404
    assert ana.get(URL).json() == []


def test_custom_frequency(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")

    ok = ana.post(URL, json={**SALARY, "frequency": "custom", "custom_period_days": 10})
    missing_days = ana.post(URL, json={**SALARY, "frequency": "custom"})
    stray_days = ana.post(URL, json={**SALARY, "custom_period_days": 10})

    assert ok.status_code == 201
    assert missing_days.status_code == stray_days.status_code == 422


@pytest.mark.parametrize(
    "override",
    [
        {"amount": "0"},
        {"amount": "-10"},
        {"amount": "10.999"},
        {"label": "   "},
        {"label": "x" * 101},
        {"frequency": "hourly"},
        {"start_date": "no-es-fecha"},
        {"id": "00000000-0000-0000-0000-000000000000"},
    ],
)
def test_invalid_incomes_are_rejected(
    login_as: Callable[[str], TestClient], override: dict[str, object]
) -> None:
    ana = login_as("ana@example.com")

    assert ana.post(URL, json={**SALARY, **override}).status_code == 422


def test_unknown_id_is_404(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")

    assert ana.get(f"{URL}/00000000-0000-0000-0000-000000000000").status_code == 404


def test_writes_require_csrf(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")
    del ana.headers["X-CSRF-Token"]

    assert ana.post(URL, json=SALARY).status_code == 403
