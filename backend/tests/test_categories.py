from collections.abc import Callable

from fastapi.testclient import TestClient

URL = "/api/v1/categories"
DEFAULT_NAMES = ["Comida", "Ocio", "Otros", "Servicios", "Transporte"]


def test_list_starts_with_the_shared_defaults(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")

    categories = ana.get(URL).json()

    assert [c["name"] for c in categories] == DEFAULT_NAMES
    assert all(c["is_default"] for c in categories)
    assert all("user_id" not in c for c in categories)


def test_create_own_category(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")

    response = ana.post(URL, json={"name": "  Gimnasio ", "color": "#5B4BDB"})

    assert response.status_code == 201
    assert response.json()["name"] == "Gimnasio"
    assert response.json()["is_default"] is False
    assert [c["name"] for c in ana.get(URL).json()] == [*DEFAULT_NAMES, "Gimnasio"]


def test_names_are_unique_case_insensitively_including_defaults(
    login_as: Callable[[str], TestClient],
) -> None:
    ana = login_as("ana@example.com")
    ana.post(URL, json={"name": "Gimnasio", "color": "#5B4BDB"})

    assert ana.post(URL, json={"name": "gimnasio", "color": "#FF7A59"}).status_code == 409
    assert ana.post(URL, json={"name": "COMIDA", "color": "#FF7A59"}).status_code == 409


def test_users_do_not_see_each_others_categories(login_as: Callable[[str], TestClient]) -> None:
    ana, beto = login_as("ana@example.com"), login_as("beto@example.com")
    ana.post(URL, json={"name": "Gimnasio", "color": "#5B4BDB"})

    assert [c["name"] for c in beto.get(URL).json()] == DEFAULT_NAMES
    # ...and the name is free for Beto
    assert beto.post(URL, json={"name": "Gimnasio", "color": "#5B4BDB"}).status_code == 201


def test_update_and_delete_own_category(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")
    category_id = ana.post(URL, json={"name": "Gimnasio", "color": "#5B4BDB"}).json()["id"]

    updated = ana.put(f"{URL}/{category_id}", json={"name": "Deporte", "color": "#0F7A57"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Deporte"

    assert ana.delete(f"{URL}/{category_id}").status_code == 204
    assert [c["name"] for c in ana.get(URL).json()] == DEFAULT_NAMES


def test_default_categories_are_read_only(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")
    default_id = ana.get(URL).json()[0]["id"]

    assert ana.put(f"{URL}/{default_id}", json={"name": "X", "color": "#000000"}).status_code == 403
    assert ana.delete(f"{URL}/{default_id}").status_code == 403


def test_deleting_a_category_keeps_its_transactions(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")
    category_id = ana.post(URL, json={"name": "Gimnasio", "color": "#5B4BDB"}).json()["id"]
    transaction = ana.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "amount": "25.00",
            "category_id": category_id,
            "occurred_on": "2026-10-01",
        },
    ).json()

    ana.delete(f"{URL}/{category_id}")

    kept = ana.get(f"/api/v1/transactions/{transaction['id']}")
    assert kept.status_code == 200
    assert kept.json()["category_id"] is None


def test_invalid_color_is_rejected(login_as: Callable[[str], TestClient]) -> None:
    ana = login_as("ana@example.com")

    assert ana.post(URL, json={"name": "X", "color": "red"}).status_code == 422
