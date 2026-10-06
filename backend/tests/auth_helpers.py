from fastapi.testclient import TestClient
from httpx import Response

from app.main import app

STRONG_PASSWORD = "Lluvia-Verde-2026!"
API = "/api/v1/auth"


def register(
    client: TestClient,
    email: str = "ana@example.com",
    password: str = STRONG_PASSWORD,
    name: str = "Ana",
) -> Response:
    return client.post(f"{API}/register", json={"email": email, "password": password, "name": name})


def login(
    client: TestClient, email: str = "ana@example.com", password: str = STRONG_PASSWORD
) -> Response:
    return client.post(f"{API}/login", json={"email": email, "password": password})


def register_and_login(client: TestClient, email: str = "ana@example.com") -> Response:
    register(client, email=email)
    response = login(client, email=email)
    assert response.status_code == 200, response.text
    return response


def csrf_headers(client: TestClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("csrf_token") or ""}


def cookie_value(response: Response, name: str) -> str:
    for header in response.headers.get_list("set-cookie"):
        cookie_name, _, rest = header.partition("=")
        if cookie_name == name:
            return rest.split(";", 1)[0]
    raise AssertionError(f"cookie {name!r} not set")


def set_cookie_header(response: Response, name: str) -> str:
    for header in response.headers.get_list("set-cookie"):
        if header.startswith(f"{name}="):
            return header
    raise AssertionError(f"cookie {name!r} not set")


def post_with_cookies(path: str, cookies: dict[str, str], csrf: str | None = None) -> Response:
    """POST from a fresh client that sends exactly these cookies (e.g. a stolen token)."""
    cookie_header = "; ".join(f"{name}={value}" for name, value in cookies.items())
    headers = {"Cookie": cookie_header}
    if csrf is not None:
        headers["X-CSRF-Token"] = csrf
    with TestClient(app, base_url="https://testserver") as other:
        return other.post(path, headers=headers)
