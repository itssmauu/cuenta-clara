from datetime import date
from functools import lru_cache
from typing import Annotated, Literal, Self

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, StringConstraints, model_validator

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.schemas.common import InputModel
from app.services import assistant as assistant_service

router = APIRouter(prefix="/assistant", tags=["assistant"])

MessageText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)
]


class ChatMessage(InputModel):
    role: Literal["user", "assistant"]
    content: MessageText


class ChatIn(InputModel):
    # The client keeps the conversation (nothing is stored on the server); only the
    # latest turns are sent, and the last one must be the user's question
    messages: Annotated[
        list[ChatMessage], Field(min_length=1, max_length=assistant_service.MAX_HISTORY)
    ]

    @model_validator(mode="after")
    def _ends_with_a_question(self) -> Self:
        if self.messages[-1].role != "user":
            raise ValueError("El último mensaje debe ser tuyo.")
        return self


class ChatOut(BaseModel):
    reply: str
    # False when the question was not about the user's finances (Balbo declined)
    on_topic: bool


class StatusOut(BaseModel):
    name: str
    available: bool


def get_assistant_model() -> assistant_service.AssistantModel | None:
    """The configured model, or None without an API key (tests replace this)."""
    settings = get_settings()
    key = settings.gemini_api_key.get_secret_value().strip() if settings.gemini_api_key else ""
    if not key:
        return None
    return assistant_service.GeminiModel(key, settings.gemini_model)


@lru_cache
def get_rate_limiter() -> assistant_service.RateLimiter:
    return assistant_service.RateLimiter(get_settings().assistant_messages_per_hour)


Model = Annotated[assistant_service.AssistantModel | None, Depends(get_assistant_model)]
Limiter = Annotated[assistant_service.RateLimiter, Depends(get_rate_limiter)]


@router.get("", response_model=StatusOut)
def assistant_status(user: CurrentUser, model: Model) -> StatusOut:
    return StatusOut(name=assistant_service.NAME, available=model is not None)


@router.post("/chat", response_model=ChatOut)
def chat(body: ChatIn, db: DbSession, user: CurrentUser, model: Model, limiter: Limiter) -> ChatOut:
    if model is None:
        raise assistant_service.AssistantUnavailableError
    limiter.check(user.id)
    context = assistant_service.build_context(db, user, date.today())
    reply, on_topic = assistant_service.answer(
        model, context, [(m.role, m.content) for m in body.messages]
    )
    return ChatOut(reply=reply, on_topic=on_topic)
