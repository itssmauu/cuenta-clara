"""What the API needs to be safe on Vercel: the proxy gate, the visitor IP it sends,
shared rate-limit counters and hosted-database URLs."""

import uuid

import pytest
from fastapi.testclient import TestClient
from limits.storage import MemoryStorage
from pydantic import SecretStr, ValidationError

from app.core.config import Settings, get_settings
from app.services.assistant import AssistantBusyError, RateLimiter
from tests.auth_helpers import STRONG_PASSWORD

SECRET = "proxy-secret-for-tests-" + "x" * 24
VALID_URL = "postgresql+psycopg://user:pass@localhost:5432/db"


@pytest.fixture
def behind_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "proxy_secret", SecretStr(SECRET))


def from_proxy(client_ip: str = "198.51.100.7") -> dict[str, str]:
    return {"X-Proxy-Secret": SECRET, "X-Client-IP": client_ip}


# ── Only the web app's proxy can reach the API ──────────


@pytest.mark.usefixtures("behind_proxy")
@pytest.mark.parametrize("headers", [{}, {"X-Proxy-Secret": "wrong"}, {"X-Proxy-Secret": ""}])
def test_without_the_proxy_secret_the_api_looks_empty(
    client: TestClient, headers: dict[str, str]
) -> None:
    for method, path in (("GET", "/api/v1/auth/me"), ("POST", "/api/v1/auth/login")):
        response = client.request(method, path, headers=headers, json={})
        assert response.status_code == 404
        assert response.json() == {"detail": "No encontrado."}


@pytest.mark.usefixtures("behind_proxy")
def test_with_the_secret_requests_go_through(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me", headers=from_proxy()).status_code == 401


@pytest.mark.usefixtures("behind_proxy")
def test_the_health_check_stays_reachable(client: TestClient) -> None:
    assert client.get("/api/v1/health").status_code == 200


def test_without_a_secret_configured_there_is_no_gate(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401


# ── The visitor IP comes from the proxy ─────────────────


def _login(client: TestClient, headers: dict[str, str], email: str) -> int:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": STRONG_PASSWORD},
        headers=headers,
    )
    return response.status_code


@pytest.mark.usefixtures("behind_proxy")
def test_each_visitor_the_proxy_reports_gets_their_own_limit(client: TestClient) -> None:
    limit = int(get_settings().login_rate_limit.split("/")[0])
    for i in range(limit):
        # Even if the client invents X-Forwarded-For, only X-Client-IP from the proxy counts
        headers = from_proxy("198.51.100.7") | {"X-Forwarded-For": f"203.0.113.{i}"}
        assert _login(client, headers, f"user{i}@example.com") == 401

    assert _login(client, from_proxy("198.51.100.7"), "otro@example.com") == 429
    assert _login(client, from_proxy("198.51.100.8"), "otro@example.com") == 401


@pytest.mark.usefixtures("behind_proxy")
def test_a_malformed_visitor_ip_falls_back_to_the_connection(client: TestClient) -> None:
    limit = int(get_settings().login_rate_limit.split("/")[0])
    for i in range(limit):
        assert _login(client, from_proxy(f"not-an-ip-{i}"), f"user{i}@example.com") == 401

    assert _login(client, from_proxy("garbage"), "otro@example.com") == 429


# ── Shared counters ─────────────────────────────────────


def test_balbo_limit_is_shared_between_instances() -> None:
    """Two serverless instances on the same store see the same count."""
    store = MemoryStorage()
    first, second = RateLimiter(2, store), RateLimiter(2, store)
    user = uuid.uuid4()

    first.check(user)
    second.check(user)

    with pytest.raises(AssistantBusyError):
        first.check(user)
    RateLimiter(2, store).check(uuid.uuid4())  # someone else is not affected


def test_redis_url_is_accepted_as_the_rate_limit_store(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", VALID_URL)
    monkeypatch.setenv("REDIS_URL", "rediss://default:token@example.upstash.io:6379")

    settings = Settings(_env_file=None)

    assert settings.rate_limit_storage_uri.startswith("rediss://")


# ── Hosted Postgres URLs ────────────────────────────────


@pytest.mark.parametrize(
    "url",
    [
        "postgres://user:pass@ep-x-pooler.neon.tech/db?sslmode=require",
        "postgresql://user:pass@ep-x-pooler.neon.tech/db?sslmode=require",
    ],
)
def test_hosted_database_urls_use_psycopg(monkeypatch: pytest.MonkeyPatch, url: str) -> None:
    monkeypatch.setenv("DATABASE_URL", url)

    settings = Settings(_env_file=None)

    assert str(settings.database_url).startswith("postgresql+psycopg://user:pass@ep-x-pooler")
    assert "sslmode=require" in str(settings.database_url)


# ── Vercel refuses unsafe production settings ───────────

PRODUCTION = {"app_env": "production", "frontend_origin": "https://cuentaclara.example"}
SAFE_ON_VERCEL = {"rate_limit_storage_uri": "rediss://h:6379", "proxy_secret": SECRET}


@pytest.mark.parametrize(
    "missing",
    ["rate_limit_storage_uri", "proxy_secret"],
)
def test_vercel_production_needs_shared_counters_and_the_proxy_secret(
    monkeypatch: pytest.MonkeyPatch, missing: str
) -> None:
    monkeypatch.setenv("DATABASE_URL", VALID_URL)
    monkeypatch.setenv("VERCEL", "1")
    values = {k: v for k, v in SAFE_ON_VERCEL.items() if k != missing}

    with pytest.raises(ValidationError):
        Settings(_env_file=None, **(PRODUCTION | values))  # type: ignore[arg-type]

    Settings(_env_file=None, **(PRODUCTION | SAFE_ON_VERCEL))  # type: ignore[arg-type]


def test_an_empty_proxy_secret_means_none(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", VALID_URL)
    monkeypatch.setenv("PROXY_SECRET", "")

    assert Settings(_env_file=None).proxy_secret is None


def test_a_short_proxy_secret_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", VALID_URL)

    with pytest.raises(ValidationError):
        Settings(_env_file=None, proxy_secret="too-short")  # type: ignore[arg-type]
