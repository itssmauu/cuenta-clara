import uuid
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.core.password_policy import MAX_LENGTH


def _normalize_email(email: str) -> str:
    return email.strip().lower()


NormalizedEmail = Annotated[EmailStr, AfterValidator(_normalize_email)]
# Strength rules are checked in the service (they need the email and name for context)
Password = Annotated[str, Field(min_length=1, max_length=MAX_LENGTH)]


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: NormalizedEmail
    password: Password
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: NormalizedEmail
    password: Password


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str


class MessageResponse(BaseModel):
    message: str


class WeakPasswordResponse(BaseModel):
    detail: str
    problems: list[str]
