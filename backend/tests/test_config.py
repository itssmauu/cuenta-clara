import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app

VALID_URL = "postgresql+psycopg://user:pass@localhost:5432/db"


def test_settings_read_database_url_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", VALID_URL)

    settings = Settings(_env_file=None)

    assert str(settings.database_url) == VALID_URL


def test_settings_reject_non_postgres_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "mysql://user:pass@localhost/db")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_reject_unknown_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", VALID_URL)
    monkeypatch.setenv("APP_ENV", "staging-ish")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_api_docs_are_disabled_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    production = Settings(_env_file=None, database_url=VALID_URL, app_env="production")
    monkeypatch.setattr("app.main.get_settings", lambda: production)

    prod_app = create_app()

    assert prod_app.docs_url is None
    assert prod_app.openapi_url is None
