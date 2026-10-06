from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

URL = "/api/v1/settings"

VALID = {
    "initial_balance": "100.00",
    "currency": "USD",
    "income_period": "weekly",
    "spending_limit": "30.00",
    "onboarding_completed": True,
}


def test_new_account_starts_with_default_settings(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")

    response = ana.get(URL)

    assert response.status_code == 200
    assert response.json() == {
        "initial_balance": "0.00",
        "currency": "USD",
        "income_period": "monthly",
        "custom_period_days": None,
        "spending_limit": None,
        "onboarding_completed": False,
    }


def test_settings_can_be_replaced(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")

    response = ana.put(URL, json=VALID)

    assert response.status_code == 200
    assert ana.get(URL).json() == {**VALID, "custom_period_days": None}


def test_custom_period_needs_days(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")

    without_days = ana.put(URL, json={**VALID, "income_period": "custom"})
    with_days = ana.put(URL, json={**VALID, "income_period": "custom", "custom_period_days": 10})

    assert without_days.status_code == 422
    assert with_days.status_code == 200


@pytest.mark.parametrize(
    "override",
    [
        {"initial_balance": "-1.00"},
        {"initial_balance": "1.001"},  # more than 2 decimals
        {"initial_balance": "12345678901.00"},  # does not fit NUMERIC(12, 2)
        {"currency": "usd"},
        {"spending_limit": "-5"},
        {"income_period": "yearly"},
        {"user_id": "00000000-0000-0000-0000-000000000000"},  # unknown field
    ],
)
def test_invalid_settings_are_rejected(
    login_as: Callable[[str], TestClient], override: dict[str, object]
) -> None:
    ana = login_as("ana@example.com")

    assert ana.put(URL, json={**VALID, **override}).status_code == 422


def test_settings_require_a_session(client: TestClient) -> None:
    assert client.get(URL).status_code == 401
