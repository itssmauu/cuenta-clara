import uuid

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.finance import CategoryIn, CategoryOut
from app.services import categories as category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: DbSession, user: CurrentUser) -> list[CategoryOut]:
    """Shared defaults first, then the user's own categories."""
    return [CategoryOut.model_validate(c) for c in category_service.list_categories(db, user)]


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(body: CategoryIn, db: DbSession, user: CurrentUser) -> CategoryOut:
    category = category_service.create_category(db, user, name=body.name, color=body.color)
    return CategoryOut.model_validate(category)


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: uuid.UUID, body: CategoryIn, db: DbSession, user: CurrentUser
) -> CategoryOut:
    category = category_service.update_category(
        db, user, category_id, name=body.name, color=body.color
    )
    return CategoryOut.model_validate(category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    category_service.delete_category(db, user, category_id)
