import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin


class PasswordResetCode(IdMixin, Base):
    """A 6-digit code emailed to reset a forgotten password.

    Only a keyed hash of the code is stored. It expires after a few minutes, allows a few
    wrong attempts, works once, and asking for a new code deletes the older ones.
    """

    __tablename__ = "password_reset_codes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
