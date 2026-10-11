from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    return create_engine(
        str(get_settings().database_url),
        # Drop dead connections (e.g. after a DB restart) instead of failing a request
        pool_pre_ping=True,
        # Serverless instances sleep and hosted databases close idle connections
        pool_recycle=300,
        # No server-side prepared statements: they break behind transaction poolers
        # such as PgBouncer (Neon's "-pooler" URLs)
        connect_args={"prepare_threshold": None},
    )


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed."""
    with get_sessionmaker()() as session:
        yield session
