from fastapi.testclient import TestClient

from app.core.config import get_settings


def test_security_headers_are_set(client: TestClient) -> None:
    headers = client.get("/api/v1/health").headers

    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["Referrer-Policy"] == "no-referrer"
    assert headers["Cache-Control"] == "no-store"
    assert "default-src 'none'" in headers["Content-Security-Policy"]
    # HSTS only in production (it would pin HTTPS on localhost for months)
    assert "Strict-Transport-Security" not in headers


def _preflight(client: TestClient, origin: str) -> dict[str, str]:
    response = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type, X-CSRF-Token",
        },
    )
    return dict(response.headers)


def test_cors_allows_the_frontend_with_credentials(client: TestClient) -> None:
    headers = _preflight(client, get_settings().frontend_origin)

    assert headers["access-control-allow-origin"] == get_settings().frontend_origin
    assert headers["access-control-allow-credentials"] == "true"


def test_cors_ignores_other_origins(client: TestClient) -> None:
    headers = _preflight(client, "https://evil.example")

    assert "access-control-allow-origin" not in headers


def test_state_changing_requests_need_csrf_even_without_session(client: TestClient) -> None:
    assert client.post("/api/v1/auth/logout").status_code == 403
