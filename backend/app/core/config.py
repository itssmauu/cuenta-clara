import os
from functools import lru_cache
from typing import Any, Literal, Self

from pydantic import AliasChoices, Field, PostgresDsn, SecretStr, field_validator, model_validator
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
    # Where rate-limit counters live. memory:// is per process: fine for one server, useless
    # on serverless (Vercel) or with several instances, which need Redis (rediss://…).
    rate_limit_storage_uri: str = Field(
        default="memory://",
        validation_alias=AliasChoices("RATE_LIMIT_STORAGE_URI", "REDIS_URL"),
    )
    # Shared only with the web app's proxy. When set, the API answers nothing that does not
    # carry it (so nobody can skip the web app) and trusts the visitor IP that proxy sends.
    proxy_secret: SecretStr | None = Field(default=None, min_length=32)
    max_failed_logins: int = Field(default=5, ge=1)
    lockout_minutes: int = Field(default=15, ge=1)

    # ── Email (password recovery) ───────────────────────
    # Any SMTP provider. Gmail: smtp.gmail.com, 587, the address and an app password.
    # Without it, password recovery reports itself as unavailable (in development the
    # emails are printed to the log instead).
    smtp_host: str = ""
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str = ""
    smtp_password: SecretStr | None = None
    # Shown as the sender, e.g. "Cuenta Clara <cuentaclara.soporte@gmail.com>"
    smtp_from: str = ""
    password_reset_code_minutes: int = Field(default=15, ge=5, le=60)
    # Per IP and per email address, for asking for a code
    password_reset_rate_limit: str = "5/hour"  # noqa: S105 - a rate, not a password
    password_reset_email_rate_limit: str = "3/hour"  # noqa: S105 - a rate, not a password
    # "Forgot password" always takes at least this long, so the response time does not
    # reveal whether an email was sent (that is, whether the account exists)
    password_reset_min_seconds: float = Field(default=3.0, ge=0, le=10)

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

    @field_validator("proxy_secret", mode="before")
    @classmethod
    def _empty_means_unset(cls, value: Any) -> Any:
        """`PROXY_SECRET=` (as in .env.example) means no proxy secret, not a short one."""
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("database_url", mode="before")
    @classmethod
    def _use_psycopg(cls, value: Any) -> Any:
        """Hosted databases (Neon, Supabase…) hand out postgres:// URLs; we ship psycopg 3."""
        if isinstance(value, str):
            for prefix in ("postgres://", "postgresql://"):
                if value.startswith(prefix):
                    return "postgresql+psycopg://" + value.removeprefix(prefix)
        return value

    @model_validator(mode="after")
    def _production_must_be_secure(self) -> Self:
        if self.is_production and not self.cookie_secure:
            raise ValueError("COOKIE_SECURE must be true in production")
        # Secure cookies and HSTS only make sense over HTTPS
        if self.is_production and not self.frontend_origin.startswith("https://"):
            raise ValueError("FRONTEND_ORIGIN must be an https:// address in production")
        # On Vercel every request may land on a different instance, and the API has a
        # public URL of its own: refuse to run without shared counters and the proxy secret
        if self.is_production and os.environ.get("VERCEL"):
            if self.rate_limit_storage_uri.startswith("memory"):
                raise ValueError("On Vercel, set RATE_LIMIT_STORAGE_URI (or REDIS_URL) to Redis")
            if self.proxy_secret is None:
                raise ValueError("On Vercel, set PROXY_SECRET (the same value in the web app)")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # required values come from the environment
