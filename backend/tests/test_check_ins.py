"""Fixed expenses only count once the user confirms they paid them ("check-ins")."""

from collections.abc import Callable
from datetime import date

import pytest
from fastapi.testclient import TestClient

from tests.auth_helpers import set_primary_balance

API = "/api/v1"
MONDAY = date(2026, 10, 5)
WEDNESDAY = date(2026, 10, 7)


@pytest.fixture
def ana(login_as: Callable[[str], TestClient], utc_today: Callable[[date], None]) -> TestClient:
    """$100 on Monday 2026-10-05; her fixed expenses are created that same Monday."""
    utc_today(MONDAY)
    client = login_as("ana@example.com")
    client.put(
        f"{API}/settings",
        json={
            "balance_as_of": MONDAY.isoformat(),
            "income_period": "weekly",
            "onboarding_completed": True,
        },
    ).raise_for_status()
    set_primary_balance(client, "100.00")
    return client


def add_expense(client: TestClient, name: str, amount: str, frequency: str, **extra: object) -> str:
    response = client.post(
        f"{API}/fixed-expenses",
        json={
            "name": name,
            "amount": amount,
            "frequency": frequency,
            "start_date": MONDAY.isoformat(),
            **extra,
        },
    )
    response.raise_for_status()
    return str(response.json()["id"])


def pending(client: TestClient, today: date = WEDNESDAY) -> dict[str, list[str]]:
    response = client.get(f"{API}/fixed-expenses/pending", params={"date": today.isoformat()})
    assert response.status_code == 200
    return {item["name"]: item["dates"] for item in response.json()}


def answer(client: TestClient, *answers: tuple[str, str, bool], today: date = WEDNESDAY) -> int:
    response = client.post(
        f"{API}/fixed-expenses/check-ins",
        params={"date": today.isoformat()},
        json={
            "answers": [
                {"fixed_expense_id": expense_id, "occurs_on": on, "paid": paid}
                for expense_id, on, paid in answers
            ]
        },
    )
    return response.status_code


def balance(client: TestClient, today: date = WEDNESDAY) -> str:
    accounts = client.get(f"{API}/accounts", params={"date": today.isoformat()}).json()
    return str(accounts[0]["balance"])


@pytest.fixture
def expenses(ana: TestClient, utc_today: Callable[[date], None]) -> dict[str, str]:
    """A $5 lunch every day and $20 internet every Monday; now it is Wednesday."""
    ids = {
        "Almuerzo": add_expense(ana, "Almuerzo", "5.00", "daily"),
        "Internet": add_expense(ana, "Internet", "20.00", "weekly"),
    }
    utc_today(WEDNESDAY)
    return ids


def test_due_expenses_are_asked_about_and_do_not_count_until_answered(
    ana: TestClient, expenses: dict[str, str]
) -> None:
    assert pending(ana) == {
        "Almuerzo": ["2026-10-05", "2026-10-06", "2026-10-07"],
        "Internet": ["2026-10-05"],
    }
    item = ana.get(f"{API}/fixed-expenses/pending", params={"date": "2026-10-07"}).json()[0]
    assert item["amount"] == "5.00"
    assert item["account_name"]

    # Nothing was deducted behind the user's back
    assert balance(ana) == "100.00"
    # The rest of the week is still expected: 4 more lunches (Thu–Sun) = $20
    dashboard = ana.get(f"{API}/dashboard", params={"date": "2026-10-07"}).json()
    assert dashboard["available_balance"] == "80.00"


def test_answers_decide_what_counts(ana: TestClient, expenses: dict[str, str]) -> None:
    lunch, internet = expenses["Almuerzo"], expenses["Internet"]

    status = answer(
        ana,
        (lunch, "2026-10-05", True),
        (lunch, "2026-10-06", False),  # skipped lunch that day
        (lunch, "2026-10-07", True),
        (internet, "2026-10-05", True),
    )

    assert status == 204
    assert pending(ana) == {}
    assert balance(ana) == "70.00"  # 100 − 5 − 5 − 20
    report = ana.get(
        f"{API}/reports/export",
        params={"format": "csv", "from": "2026-10-05", "to": "2026-10-07", "type": "expense"},
    )
    lunches = [line for line in report.text.splitlines() if "Almuerzo" in line]
    assert len(lunches) == 2  # the skipped day is not in the report either
    assert "2026-10-06" not in "".join(lunches)


def test_an_answer_can_be_changed(ana: TestClient, expenses: dict[str, str]) -> None:
    lunch = expenses["Almuerzo"]
    assert answer(ana, (lunch, "2026-10-07", False)) == 204
    assert pending(ana)["Almuerzo"] == ["2026-10-05", "2026-10-06"]

    assert answer(ana, (lunch, "2026-10-07", True)) == 204

    assert balance(ana) == "95.00"


def test_the_last_answer_for_a_day_wins_within_one_request(
    ana: TestClient, expenses: dict[str, str]
) -> None:
    lunch = expenses["Almuerzo"]

    assert answer(ana, (lunch, "2026-10-07", True), (lunch, "2026-10-07", False)) == 204

    assert balance(ana) == "100.00"


def test_days_before_the_expense_asked_for_confirmation_count_on_their_own(
    ana: TestClient, utc_today: Callable[[date], None]
) -> None:
    """Expenses that existed before this feature keep their history untouched."""
    utc_today(WEDNESDAY)  # created on Wednesday, starting on Monday
    add_expense(ana, "Almuerzo", "5.00", "daily")

    assert pending(ana) == {"Almuerzo": ["2026-10-07"]}
    assert balance(ana) == "90.00"  # Monday and Tuesday counted as before


@pytest.mark.parametrize(
    ("expense", "on", "today"),
    [
        ("Internet", "2026-10-06", WEDNESDAY),  # internet is not due on Tuesdays
        ("Internet", "2026-10-12", WEDNESDAY),  # not due yet
        ("Internet", "2026-10-12", date(2026, 12, 1)),  # a far-future "today" is not trusted
        ("Almuerzo", "2026-10-04", WEDNESDAY),  # before the expense started
    ],
)
def test_only_days_that_are_due_can_be_answered(
    ana: TestClient, expenses: dict[str, str], expense: str, on: str, today: date
) -> None:
    assert answer(ana, (expenses[expense], on, True), today=today) == 422
    assert balance(ana) == "100.00"


def test_paused_expenses_are_not_asked_about(
    ana: TestClient, utc_today: Callable[[date], None]
) -> None:
    paused = add_expense(ana, "Gimnasio", "15.00", "daily", is_active=False)
    utc_today(WEDNESDAY)

    assert pending(ana) == {}
    assert answer(ana, (paused, "2026-10-07", True)) == 404


def test_nobody_can_see_or_answer_someone_elses_expenses(
    ana: TestClient, expenses: dict[str, str], login_as: Callable[[str], TestClient]
) -> None:
    beto = login_as("beto@example.com")

    assert pending(beto) == {}
    assert answer(beto, (expenses["Almuerzo"], "2026-10-07", True)) == 404
    assert pending(ana)["Almuerzo"] == ["2026-10-05", "2026-10-06", "2026-10-07"]


@pytest.mark.parametrize(
    "body",
    [
        {"answers": []},
        {"answers": [{"fixed_expense_id": "x", "occurs_on": "2026-10-07", "paid": True}]},
        {
            "answers": [
                {
                    "fixed_expense_id": "00000000-0000-0000-0000-000000000000",
                    "occurs_on": "2026-10-07",
                    "paid": True,
                    "user_id": "00000000-0000-0000-0000-000000000000",
                }
            ]
        },
    ],
)
def test_check_ins_reject_malformed_bodies(
    ana: TestClient, expenses: dict[str, str], body: dict[str, object]
) -> None:
    response = ana.post(f"{API}/fixed-expenses/check-ins", json=body)
    assert response.status_code == 422


def test_at_most_400_answers_per_request(ana: TestClient, expenses: dict[str, str]) -> None:
    one = {"fixed_expense_id": expenses["Almuerzo"], "occurs_on": "2026-10-07", "paid": True}
    response = ana.post(f"{API}/fixed-expenses/check-ins", json={"answers": [one] * 401})
    assert response.status_code == 422


def test_answers_are_part_of_the_data_export_and_go_with_the_expense(
    ana: TestClient, expenses: dict[str, str]
) -> None:
    lunch = expenses["Almuerzo"]
    answer(ana, (lunch, "2026-10-07", False))

    exported = ana.get(f"{API}/me/export").json()["gastos_fijos_confirmados"]
    assert [(row["occurs_on"], row["paid"]) for row in exported] == [("2026-10-07", False)]
    assert "user_id" not in exported[0]

    ana.delete(f"{API}/fixed-expenses/{lunch}").raise_for_status()
    assert ana.get(f"{API}/me/export").json()["gastos_fijos_confirmados"] == []


def test_check_ins_require_a_session_and_csrf(ana: TestClient, client: TestClient) -> None:
    assert client.get(f"{API}/fixed-expenses/pending").status_code == 401
    del ana.headers["X-CSRF-Token"]
    response = ana.post(
        f"{API}/fixed-expenses/check-ins",
        json={
            "answers": [
                {
                    "fixed_expense_id": "00000000-0000-0000-0000-000000000000",
                    "occurs_on": "2026-10-07",
                    "paid": True,
                }
            ]
        },
    )
    assert response.status_code == 403
