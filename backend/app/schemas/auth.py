import uuid
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    computed_field,
)

from app.core.legal import TERMS_VERSION
from app.core.password_policy import MAX_LENGTH


def _normalize_email(email: str) -> str:
    return email.strip().lower()


NormalizedEmail = Annotated[EmailStr, AfterValidator(_normalize_email)]


def _must_accept(accepted: bool) -> bool:
    if not accepted:
        raise ValueError("Debes aceptar los Términos y la Política de privacidad.")
    return accepted


# Strength rules are checked in the service (they need the email and name for context)
Password = Annotated[str, Field(min_length=1, max_length=MAX_LENGTH)]


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: NormalizedEmail
    password: Password
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    # Ley 81: consent must be explicit, so the box has to be ticked (no default)
    accept_terms: Annotated[bool, AfterValidator(_must_accept)]


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: NormalizedEmail
    password: Password


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    terms_version: str | None = Field(default=None, exclude=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def terms_accepted(self) -> bool:
        """False when the user still has to accept the current Terms and Privacy Policy."""
        return self.terms_version == TERMS_VERSION


class ConsentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The version the user saw and accepted; only the current one is valid
    terms_version: str


class DeleteAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: Password


class MessageResponse(BaseModel):
    message: str


class WeakPasswordResponse(BaseModel):
    detail: str
    problems: list[str]
