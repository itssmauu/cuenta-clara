"""CSV export of transactions, safe to open in Excel or Google Sheets."""

import csv
import io
from collections.abc import Iterable

from app.models import Category, Transaction, TransactionType

# A cell starting with one of these is treated as a formula by spreadsheet apps; a note
# like "=HYPERLINK(...)" could run when the file is opened (CSV/formula injection)
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

HEADER = ["fecha", "tipo", "monto", "categoria", "nota"]


def safe_cell(value: str) -> str:
    """Neutralize text that a spreadsheet would interpret as a formula."""
    return f"'{value}" if value.startswith(FORMULA_PREFIXES) else value


def transactions_csv(
    transactions: Iterable[Transaction], categories: dict[object, Category]
) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(HEADER)
    for t in transactions:
        category = categories.get(t.category_id) if t.category_id else None
        writer.writerow(
            [
                t.occurred_on.isoformat(),
                "ingreso" if t.type == TransactionType.INCOME else "gasto",
                # Signed plain number (not user text): expenses negative, incomes positive
                f"{'-' if t.type == TransactionType.EXPENSE else ''}{t.amount}",
                safe_cell(category.name) if category else "",
                safe_cell(t.note or ""),
            ]
        )
    # BOM so Excel detects UTF-8 and shows accents (Categoría, Pasaje…) correctly
    return "﻿" + buffer.getvalue()
