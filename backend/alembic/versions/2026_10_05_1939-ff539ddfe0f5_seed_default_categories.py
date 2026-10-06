"""seed default categories

Revision ID: ff539ddfe0f5
Revises: 119eebcb4eaa
Create Date: 2026-10-05 19:39:19.115559

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ff539ddfe0f5"
down_revision: str | Sequence[str] | None = "119eebcb4eaa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# A frozen copy of the table: data migrations must not import app models, which keep changing
categories = sa.table(
    "categories",
    sa.column("user_id", sa.Uuid),
    sa.column("name", sa.String),
    sa.column("color", sa.String),
)

# Shared defaults (user_id NULL), colored with the design tokens
DEFAULT_CATEGORIES = [
    {"name": "Transporte", "color": "#5B4BDB"},
    {"name": "Servicios", "color": "#7B6CF0"},
    {"name": "Comida", "color": "#FF7A59"},
    {"name": "Ocio", "color": "#0F7A57"},
    {"name": "Otros", "color": "#55587E"},
]


def upgrade() -> None:
    op.bulk_insert(categories, [{"user_id": None, **c} for c in DEFAULT_CATEGORIES])


def downgrade() -> None:
    op.execute(
        categories.delete().where(
            categories.c.user_id.is_(None),
            categories.c.name.in_([c["name"] for c in DEFAULT_CATEGORIES]),
        )
    )
