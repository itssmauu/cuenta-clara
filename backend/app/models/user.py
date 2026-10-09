from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, true
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        # Emails are normalized before insert; the DB guarantees it never drifts
        CheckConstraint("email = lower(email)", name="email_lowercase"),
        CheckConstraint("failed_login_attempts >= 0", name="failed_login_attempts_non_negative"),
    )

    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())

    # Proof of consent (Ley 81): which version of the Terms and Privacy Policy, and when
    terms_version: Mapped[str | None] = mapped_column(String(20))
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Temporary lockout after repeated failed logins (see services/auth.py)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
