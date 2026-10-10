from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, PostgresDsn, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from environment variables.

    Real environment variables win over `.env` files. Both the repo-root `.env`
    (shared with Docker Compose) and `backend/.env` are read when present.
    """

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Cuenta Clara API"
    app_env: Literal["development", "test", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    database_url: PostgresDsn

    # ── Auth ────────────────────────────────────────────
    # HS256 signing key, at least 32 random characters. Generate one with:
    #   python -c "import secrets; print(secrets.token_urlsafe(48))"
    jwt_secret_key: SecretStr = Field(min_length=32)
    access_token_ttl_minutes: int = Field(default=15, ge=1, le=60)
    refresh_token_ttl_days: int = Field(default=7, ge=1, le=30)
    # Secure cookies are only sent over HTTPS (browsers treat http://localhost as secure too)
    cookie_secure: bool = True

    # ── Abuse protection ────────────────────────────────
    login_rate_limit: str = "5/minute"
    register_rate_limit: str = "3/minute"
    # Per email address, across all IPs (slows down distributed guessing on one account)
    email_rate_limit: str = "10/hour"
    # How many proxies in front of the API append the visitor's address to
    # X-Forwarded-For: 1 = one HTTPS proxy (Caddy, nginx or the hosting platform) in front
    # of the web app. 0 = no proxy: use the connection's own address. Whatever the client
    # wrote in the header itself is never trusted. See docs/deploy.md.
    trusted_proxy_hops: int = Field(default=0, ge=0, le=5)
    max_failed_logins: int = Field(default=5, ge=1)
    lockout_minutes: int = Field(default=15, ge=1)

    # ── Assistant (Balbo) ───────────────────────────────
    # Gemini API key. Without it the assistant reports itself as unavailable.
    # Server-side only: it never reaches the browser.
    gemini_api_key: SecretStr | None = None
    # Fast and widely available; a larger model can be set here (it may be slower or busier)
    gemini_model: str = "gemini-3.5-flash-lite"
    # Per user, in a sliding hour: each message costs a model call
    assistant_messages_per_hour: int = Field(default=30, ge=1)

    # ── HTTP ────────────────────────────────────────────
    # The only origin allowed to call the API with credentials (the Next.js app)
    frontend_origin: str = "http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @model_validator(mode="after")
    def _production_must_be_secure(self) -> Self:
        if self.is_production and not self.cookie_secure:
            raise ValueError("COOKIE_SECURE must be true in production")
        # Secure cookies and HSTS only make sense over HTTPS
        if self.is_production and not self.frontend_origin.startswith("https://"):
            raise ValueError("FRONTEND_ORIGIN must be an https:// address in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # required values come from the environment
