"""The movements report as a CSV (for spreadsheets) or a PDF (to read, print or share)."""

import csv
import io
from datetime import date
from decimal import Decimal

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from app.services.export import safe_cell
from app.services.reports import Report, ReportRow

# ── CSV ─────────────────────────────────────────────────

CSV_HEADER = ["fecha", "cuenta", "tipo", "concepto", "categoria", "monto", "nota"]


def report_csv(report: Report) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(CSV_HEADER)
    for row in report.rows:
        writer.writerow(
            [
                row.on.isoformat(),
                # Every text cell can come from the user: neutralize formulas
                safe_cell(row.account),
                row.kind,
                safe_cell(row.concept),
                safe_cell(row.category),
                f"{row.amount:.2f}",
                safe_cell(row.note),
            ]
        )
    # BOM so Excel detects UTF-8 and shows accents correctly
    return "﻿" + buffer.getvalue()


# ── PDF ─────────────────────────────────────────────────

INK = (20, 22, 58)
MUTED = (85, 88, 126)
PRIMARY = (91, 75, 219)
PRIMARY_TINT = (230, 227, 255)
CANVAS = (243, 245, 251)
LINE = (225, 228, 242)
MINT_INK = (15, 122, 87)
DANGER = (180, 35, 24)

MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"]
SYMBOLS = {"USD": "$", "PAB": "B/.", "MXN": "$", "EUR": "EUR "}

# The PDF's built-in fonts cover Latin-1 (accents, ñ, ¿, ¡). A few common characters
# outside it get a close equivalent; anything else (e.g. an emoji in a note) becomes "?"
REPLACEMENTS = {"→": "»", "−": "-", "–": "-", "—": "-", "…": "...", "“": '"', "”": '"', "’": "'"}

# Table columns (mm): fecha, concepto, cuenta, tipo, monto = 180 mm on A4 with 15 mm margins
COLUMNS = [("Fecha", 22), ("Concepto", 62), ("Cuenta", 38), ("Tipo", 26), ("Monto", 32)]


def _text(value: str) -> str:
    for old, new in REPLACEMENTS.items():
        value = value.replace(old, new)
    return value.encode("latin-1", "replace").decode("latin-1")


def _date(day: date) -> str:
    return f"{day.day} {MONTHS[day.month - 1]} {day.year}"


def _money(amount: Decimal, currency: str, *, signed: bool = False) -> str:
    sign = "-" if amount < 0 else ("+" if signed and amount > 0 else "")
    return f"{sign}{SYMBOLS.get(currency, currency + ' ')}{abs(amount):,.2f}"


class _ReportPdf(FPDF):
    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", size=8)
        self.set_text_color(*MUTED)
        self.cell(
            0,
            5,
            _text("Cuenta Clara · reporte generado por ti, no es un documento bancario"),
            align="L",
        )
        self.cell(0, 5, f"Página {self.page_no()} de {{nb}}", align="R")


def _fit(pdf: FPDF, text: str, width: float) -> str:
    """Cut text to the column width, ending in '...' when it does not fit."""
    text = _text(text)
    if pdf.get_string_width(text) <= width - 2:
        return text
    while text and pdf.get_string_width(text + "...") > width - 2:
        text = text[:-1]
    return text + "..."


def _table_header(pdf: FPDF) -> None:
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_fill_color(*INK)
    pdf.set_text_color(255, 255, 255)
    for title, width in COLUMNS:
        align = "R" if title == "Monto" else "L"
        pdf.cell(width, 8, f" {title} " if align == "L" else f"{title} ", fill=True, align=align)
    pdf.ln(8)


def _summary_box(
    pdf: FPDF, x: float, y: float, label: str, value: str, color: tuple[int, int, int]
) -> None:
    pdf.set_fill_color(*CANVAS)
    pdf.rect(x, y, 43, 18, style="F", round_corners=True, corner_radius=3)
    pdf.set_xy(x + 4, y + 3)
    pdf.set_font("Helvetica", size=8)
    pdf.set_text_color(*MUTED)
    pdf.cell(35, 4, _text(label))
    pdf.set_xy(x + 4, y + 8.5)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*color)
    pdf.cell(35, 6, _text(value))


def report_pdf(report: Report, *, generated_on: date) -> bytes:
    pdf = _ReportPdf(orientation="portrait", unit="mm", format="A4")
    pdf.set_margins(15, 15, 15)
    pdf.set_auto_page_break(auto=False)
    pdf.set_title("Reporte de movimientos")
    pdf.set_creator("Cuenta Clara")
    pdf.add_page()

    # Header
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*PRIMARY)
    pdf.cell(0, 6, "Cuenta Clara", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*INK)
    pdf.cell(0, 10, "Reporte de movimientos", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", size=9.5)
    pdf.set_text_color(*MUTED)
    pdf.cell(
        0,
        6,
        _text(
            f"{report.scope} · del {_date(report.start)} al {_date(report.end)} · "
            f"generado el {_date(generated_on)}"
        ),
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )
    pdf.ln(4)

    # Summary
    currency = report.currency
    boxes = [
        ("Ingresos", _money(report.income, currency), MINT_INK),
        ("Gastos", _money(-report.expenses, currency), DANGER),
        ("Transferencias", _money(report.transfers, currency, signed=True), INK),
        ("Neto", _money(report.net, currency, signed=True), PRIMARY),
    ]
    # All four on one row: the top is fixed before drawing (each box moves the cursor)
    top = pdf.get_y()
    for index, (label, value, color) in enumerate(boxes):
        _summary_box(pdf, 15 + index * 45.6, top, label, value, color)
    pdf.set_y(top + 24)

    if not report.rows:
        pdf.set_font("Helvetica", size=10)
        pdf.set_text_color(*MUTED)
        pdf.cell(0, 8, "No hay movimientos en este rango de fechas.")
        return bytes(pdf.output())

    _table_header(pdf)
    bottom = pdf.h - 20
    for index, row in enumerate(report.rows):
        if pdf.get_y() + 7 > bottom:
            pdf.add_page()
            _table_header(pdf)
        _table_row(pdf, row, currency, striped=index % 2 == 1)

    if report.truncated:
        pdf.ln(3)
        pdf.set_font("Helvetica", "I", 8.5)
        pdf.set_text_color(*MUTED)
        pdf.cell(0, 5, _text(f"Se muestran los primeros {len(report.rows)} movimientos."))
    return bytes(pdf.output())


def _table_row(pdf: FPDF, row: ReportRow, currency: str, *, striped: bool) -> None:
    concept = f"{row.concept} · {row.category}" if row.category else row.concept
    cells = [
        (_date(row.on), "L"),
        (concept, "L"),
        (row.account, "L"),
        (row.kind, "L"),
        (_money(row.amount, currency, signed=True), "R"),
    ]
    pdf.set_fill_color(*(CANVAS if striped else (255, 255, 255)))
    for (value, align), (title, width) in zip(cells, COLUMNS, strict=True):
        is_amount = title == "Monto"
        pdf.set_font("Helvetica", "B" if is_amount else "", 8.5)
        if is_amount:
            pdf.set_text_color(*(MINT_INK if row.amount > 0 else INK))
        else:
            pdf.set_text_color(*INK)
        text = _fit(pdf, value, width)
        pdf.cell(width, 7, f" {text}" if align == "L" else f"{text} ", fill=True, align=align)
    pdf.ln(7)
    pdf.set_draw_color(*LINE)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
