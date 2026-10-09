import json
from datetime import date

from fastapi import APIRouter, Request, Response, status

from app.api.cookies import clear_session_cookies
from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.schemas.auth import ConsentRequest, DeleteAccountRequest, UserOut
from app.services import privacy

router = APIRouter(prefix="/me", tags=["privacy"])


@router.post("/consent", response_model=UserOut)
def accept_terms(body: ConsentRequest, db: DbSession, user: CurrentUser) -> UserOut:
    """Record that the user accepted the current Terms and Privacy Policy."""
    return UserOut.model_validate(privacy.accept_terms(db, user, body.terms_version))


@router.get(
    "/export",
    response_class=Response,
    responses={200: {"content": {"application/json": {}}, "description": "All the user's data"}},
)
def export_data(db: DbSession, user: CurrentUser) -> Response:
    """Access and portability: a full copy of the user's data as a JSON download."""

    body = json.dumps(privacy.export_user_data(db, user), ensure_ascii=False, indent=2)
    filename = f"cuenta-clara-mis-datos-{date.today().isoformat()}.json"
    return Response(
        content=body,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/delete", status_code=status.HTTP_204_NO_CONTENT)
# Same budget as logging in: the password check must not become a guessing oracle
@limiter.limit(lambda: get_settings().login_rate_limit)
def delete_account(
    request: Request,
    response: Response,
    body: DeleteAccountRequest,
    db: DbSession,
    user: CurrentUser,
) -> None:
    """Cancellation: deletes the account and all its data, then ends the session."""
    privacy.delete_account(db, user, body.password)
    clear_session_cookies(response)
