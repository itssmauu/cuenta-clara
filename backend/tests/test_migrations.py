from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.database import get_engine
from app.models import Base, Category


def test_migrations_match_models() -> None:
    """Every model change must ship with a migration."""
    with get_engine().connect() as connection:
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        diff = compare_metadata(context, Base.metadata)

    assert diff == []


def test_migrations_downgrade_and_upgrade_cleanly(alembic_config: Config) -> None:
    command.downgrade(alembic_config, "base")
    with get_engine().connect() as connection:
        tables = connection.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        ).scalars()
        assert set(tables) <= {"alembic_version"}

    command.upgrade(alembic_config, "head")


def test_default_categories_are_seeded(db_session: Session) -> None:
    defaults = db_session.scalars(
        select(Category.name).where(Category.user_id.is_(None)).order_by(Category.name)
    ).all()

    assert defaults == ["Comida", "Ocio", "Otros", "Servicios", "Transporte"]
