import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response

from app.api.deps import CurrentUser, DbSession
from app.services.report_files import report_csv, report_pdf
from app.services.reports import build_report, report_filename

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get(
    "/export",
    response_class=Response,
    responses={
        200: {
            "content": {"text/csv": {}, "application/pdf": {}},
            "description": "The movements report as a CSV or PDF file",
        }
    },
)
def export_report(
    db: DbSession,
    user: CurrentUser,
    format: Annotated[Literal["csv", "pdf"], Query(description="File format")] = "csv",
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
    type: Literal["income", "expense"] | None = None,
    account: Annotated[
        uuid.UUID | Literal["all"] | None,
        Query(description="An account id, or 'all'; defaults to the primary account"),
    ] = None,
) -> Response:
    """Movements, recurring incomes and fixed expenses, and transfers in the date range.

    Empty dates mean from the day the user started tracking until today.
    """
    report = build_report(db, user, scope=account, start=date_from, end=date_to, type_filter=type)
    if format == "pdf":
        content: str | bytes = report_pdf(report, generated_on=date.today())
        media_type = "application/pdf"
    else:
        content = report_csv(report)
        media_type = "text/csv; charset=utf-8"
    filename = report_filename(report, format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
