from collections.abc import Callable

from fastapi.testclient import TestClient

URL = "/api/v1/transactions"


def expense(amount: str, occurred_on: str, **extra: object) -> dict[str, object]:
    return {"type": "expense", "amount": amount, "occurred_on": occurred_on, **extra}


def test_transaction_crud(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")

    created = ana.post(URL, json=expense("30.00", "2026-10-03", note="Pasaje de la semana"))
    assert created.status_code == 201
    transaction = created.json()
    assert transaction["note"] == "Pasaje de la semana"

    assert ana.get(f"{URL}/{transaction['id']}").json() == transaction

    updated = ana.put(
        f"{URL}/{transaction['id']}",
        json={"type": "income", "amount": "160.00", "occurred_on": "2026-10-03"},
    )
    assert updated.json()["type"] == "income"
    assert updated.json()["note"] is None

    assert ana.delete(f"{URL}/{transaction['id']}").status_code == 204
    assert ana.get(f"{URL}/{transaction['id']}").status_code == 404


def test_list_is_newest_first_and_paginated(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")
    for day in ("01", "05", "03"):
        ana.post(URL, json=expense("1.00", f"2026-10-{day}"))

    first_page = ana.get(URL, params={"limit": 2}).json()
    second_page = ana.get(URL, params={"limit": 2, "offset": 2}).json()

    assert [t["occurred_on"] for t in first_page["items"]] == ["2026-10-05", "2026-10-03"]
    assert [t["occurred_on"] for t in second_page["items"]] == ["2026-10-01"]
    assert first_page["total"] == second_page["total"] == 3


def test_list_filters(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")
    food = next(c for c in ana.get("/api/v1/categories").json() if c["name"] == "Comida")
    ana.post(URL, json=expense("10.00", "2026-09-28"))
    ana.post(URL, json=expense("12.00", "2026-10-02", category_id=food["id"]))
    ana.post(URL, json={"type": "income", "amount": "160.00", "occurred_on": "2026-10-02"})

    def amounts(**params: str) -> list[str]:
        return sorted(t["amount"] for t in ana.get(URL, params=params).json()["items"])

    assert amounts(**{"from": "2026-10-01", "to": "2026-10-07"}) == ["12.00", "160.00"]
    assert amounts(type="expense") == ["10.00", "12.00"]
    assert amounts(category_id=food["id"]) == ["12.00"]


def test_page_size_is_capped(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")

    assert ana.get(URL, params={"limit": 101}).status_code == 422
    assert ana.get(URL, params={"offset": -1}).status_code == 422


def test_money_keeps_exact_cents(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")
    ana.post(URL, json=expense("0.10", "2026-10-01"))
    ana.post(URL, json=expense("0.20", "2026-10-01"))

    items = ana.get(URL).json()["items"]

    # Amounts travel as strings, so the client never sees a binary float
    assert sorted(t["amount"] for t in items) == ["0.10", "0.20"]
