import os
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class TestEnv(BaseSettings):
    __test__ = False  # not a test class, despite the name
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR.parent / ".env", BACKEND_DIR / ".env"), extra="ignore"
    )
    test_database_url: str | None = None


# Tests drop and recreate the schema, so they must never touch the development database.
# Require an explicit URL and point the app at it before any app module is imported.
TEST_DATABASE_URL = TestEnv().test_database_url
if not TEST_DATABASE_URL:
    raise pytest.UsageError(
        "Set TEST_DATABASE_URL to a dedicated, disposable database "
        "(e.g. postgresql+psycopg://user:pass@localhost:5432/cuentaclara_test)"
    )
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["APP_ENV"] = "test"
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-key-with-at-least-32-characters")
# Many tests register several users from the same "IP"; the login limit stays at its default
os.environ.setdefault("REGISTER_RATE_LIMIT", "1000/minute")

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.database import get_engine, get_sessionmaker  # noqa: E402
from app.core.rate_limit import reset_rate_limits  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402

ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("sqlalchemy.url", TEST_DATABASE_URL.replace("%", "%%"))
    return config


@pytest.fixture(scope="session", autouse=True)
def migrated_db(alembic_config: Config) -> None:
    """Start every test run from a clean schema built by the real migrations."""
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")


@pytest.fixture
def db_session() -> Iterator[Session]:
    """A session whose changes are rolled back after each test."""
    connection = get_engine().connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client() -> Iterator[TestClient]:
    """An API client over HTTPS (so `Secure` cookies are sent) with fresh rate limits.

    API calls commit for real, so every user created during the test is deleted
    afterwards (their data goes with them via ON DELETE CASCADE).
    """
    reset_rate_limits()
    with TestClient(app, base_url="https://testserver") as test_client:
        yield test_client
    app.dependency_overrides.clear()
    with get_sessionmaker()() as session:
        session.execute(delete(User))
        session.commit()


@pytest.fixture
def login_as(client: TestClient) -> Iterator[Callable[[str], TestClient]]:
    """Factory for logged-in clients, each with its own cookie jar and CSRF header set.

    Depends on `client` so rate limits are reset and created users are cleaned up.
    """
    from tests.auth_helpers import register_and_login

    opened: list[TestClient] = []

    def _login(email: str) -> TestClient:
        user_client = TestClient(app, base_url="https://testserver")
        user_client.__enter__()
        opened.append(user_client)
        register_and_login(user_client, email=email)
        user_client.headers["X-CSRF-Token"] = user_client.cookies.get("csrf_token") or ""
        return user_client

    yield _login
    for user_client in opened:
        user_client.__exit__(None, None, None)
