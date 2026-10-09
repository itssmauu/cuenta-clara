"""The movements report: everything that moved money in a date range, for CSV or PDF.

Unlike the transactions list, a report is what a bank statement would show: one-off
movements, every occurrence of the recurring incomes and fixed expenses, and transfers
between accounts. The same rows feed both formats, so they can never disagree.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FixedExpense, Income, Transaction, TransactionType, Transfer, User
from app.services.categories import list_categories
from app.services.dashboard import AccountScope, load_user_finance
from app.services.errors import BusinessRuleError
from app.services.periods import Period, recurring_dates

ZERO = Decimal("0.00")
MAX_ROWS = 10_000
# A long daily recurrence over many years would make a huge file: keep reports bounded
MAX_RANGE_DAYS = 366 * 3

RowKind = Literal["Ingreso", "Gasto", "Ingreso fijo", "Gasto fijo", "Transferencia"]
TypeFilter = Literal["income", "expense"] | None


@dataclass(frozen=True)
class ReportRow:
    on: date
    account: str
    kind: RowKind
    concept: str
    category: str
    # Signed: money in is positive, money out negative (seen from the report's accounts)
    amount: Decimal
    note: str


@dataclass(frozen=True)
class Report:
    start: date
    end: date
    # "Gastos del día", or "Todas las cuentas"
    scope: str
    currency: str
    rows: list[ReportRow]
    truncated: bool

    def _sum(self, *kinds: RowKind) -> Decimal:
        return sum((r.amount for r in self.rows if r.kind in kinds), ZERO)

    @property
    def income(self) -> Decimal:
        return self._sum("Ingreso", "Ingreso fijo")

    @property
    def expenses(self) -> Decimal:
        """Money spent, as a positive amount."""
        return -self._sum("Gasto", "Gasto fijo")

    @property
    def transfers(self) -> Decimal:
        return self._sum("Transferencia")

    @property
    def net(self) -> Decimal:
        return self.income - self.expenses + self.transfers


def build_report(
    db: Session,
    user: User,
    *,
    scope: AccountScope,
    start: date | None,
    end: date | None,
    type_filter: TypeFilter = None,
    today: date | None = None,
) -> Report:
    finance = load_user_finance(db, user)
    ids, single = finance.resolve(scope)
    names = {a.id: a.name for a in finance.accounts}
    settings = finance.settings

    # Empty dates: from the day the user started tracking until today
    end = end or today or date.today()
    start = start or min(settings.balance_as_of, end)
    if start > end:
        raise BusinessRuleError("La fecha «Desde» debe ser anterior o igual a «Hasta».")
    if (end - start).days > MAX_RANGE_DAYS:
        raise BusinessRuleError("Elige un rango de hasta 3 años.")
    window = Period(start, end)
    categories = {c.id: c.name for c in list_categories(db, user)}
    rows: list[ReportRow] = []

    want_income = type_filter in (None, "income")
    want_expense = type_filter in (None, "expense")

    # One-off movements (every record in the range, like the transactions list)
    kinds = []
    if want_income:
        kinds.append(TransactionType.INCOME)
    if want_expense:
        kinds.append(TransactionType.EXPENSE)
    for t in db.scalars(
        select(Transaction).where(
            Transaction.user_id == user.id,
            Transaction.account_id.in_(ids),
            Transaction.type.in_(kinds),
            Transaction.occurred_on.between(start, end),
        )
    ):
        income = t.type == TransactionType.INCOME
        rows.append(
            ReportRow(
                on=t.occurred_on,
                account=names.get(t.account_id, ""),
                kind="Ingreso" if income else "Gasto",
                concept=t.note or ("Ingreso" if income else "Gasto"),
                category="" if income else categories.get(t.category_id, ""),
                amount=t.amount if income else -t.amount,
                note=t.note or "",
            )
        )

    # Recurring items: each occurrence that counted (from balance_as_of on, while active)
    tracked = window.clip_start(settings.balance_as_of)
    if tracked is not None:
        if want_income:
            for i in db.scalars(
                select(Income).where(
                    Income.user_id == user.id,
                    Income.account_id.in_(ids),
                    Income.is_active.is_(True),
                )
            ):
                for on in recurring_dates(
                    i.frequency, i.start_date, tracked, custom_days=i.custom_period_days
                ):
                    rows.append(
                        ReportRow(
                            on,
                            names.get(i.account_id, ""),
                            "Ingreso fijo",
                            i.label,
                            "",
                            i.amount,
                            "",
                        )
                    )
        if want_expense:
            for f in db.scalars(
                select(FixedExpense).where(
                    FixedExpense.user_id == user.id,
                    FixedExpense.account_id.in_(ids),
                    FixedExpense.is_active.is_(True),
                )
            ):
                for on in recurring_dates(
                    f.frequency,
                    f.start_date,
                    tracked,
                    custom_days=f.custom_period_days,
                    day_of_month=f.due_day,
                ):
                    rows.append(
                        ReportRow(
                            on,
                            names.get(f.account_id, ""),
                            "Gasto fijo",
                            f.name,
                            categories.get(f.category_id, ""),
                            -f.amount,
                            "",
                        )
                    )

    # Transfers in or out of the scope (between two accounts in scope they cancel: skip)
    if type_filter is None:
        for tr in db.scalars(
            select(Transfer).where(
                Transfer.user_id == user.id,
                Transfer.occurred_on.between(start, end),
                Transfer.from_account_id.in_(ids) | Transfer.to_account_id.in_(ids),
            )
        ):
            source, target = tr.from_account_id in ids, tr.to_account_id in ids
            route = f"{names.get(tr.from_account_id, '')} → {names.get(tr.to_account_id, '')}"
            note = tr.note or ""
            if source and target:
                # Seen from all accounts it changes nothing: say how much moved, count 0
                amount, account = ZERO, route
                note = f"Entre tus cuentas: {tr.amount}" + (f" · {note}" if note else "")
            elif target:
                amount, account = tr.amount, names.get(tr.to_account_id, "")
            else:
                amount, account = -tr.amount, names.get(tr.from_account_id, "")
            rows.append(
                ReportRow(tr.occurred_on, account, "Transferencia", route, "", amount, note)
            )

    rows.sort(key=lambda r: (r.on, r.kind, r.concept))
    truncated = len(rows) > MAX_ROWS
    return Report(
        start=start,
        end=end,
        scope=single.name if single else "Todas las cuentas",
        currency=settings.currency,
        rows=rows[:MAX_ROWS],
        truncated=truncated,
    )


def report_filename(report: Report, extension: str) -> str:
    return f"cuenta-clara-reporte-{report.start.isoformat()}-a-{report.end.isoformat()}.{extension}"
