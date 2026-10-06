"""Calendar periods (day, week, fortnight, month, every N days) and recurring dates.

Pure functions: no database, no clock. Callers pass the reference date explicitly.
"""

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from app.models import Frequency

# Fortnights are counted from a fixed Monday so everyone's fortnights line up
BIWEEKLY_ANCHOR = date(2024, 1, 1)

# Average length, used only to convert a per-period amount to another period length
AVERAGE_DAYS: dict[Frequency, Decimal] = {
    Frequency.DAILY: Decimal(1),
    Frequency.WEEKLY: Decimal(7),
    Frequency.BIWEEKLY: Decimal(14),
    Frequency.MONTHLY: Decimal("30.4375"),  # 365.25 / 12
}


@dataclass(frozen=True, order=True)
class Period:
    """A closed range of days: both `start` and `end` are included."""

    start: date
    end: date

    def __contains__(self, day: object) -> bool:
        return isinstance(day, date) and self.start <= day <= self.end

    def clip_start(self, earliest: date) -> "Period | None":
        """The part of this period on or after `earliest`, or None if there is none."""
        if earliest > self.end:
            return None
        return Period(max(self.start, earliest), self.end)


@dataclass(frozen=True)
class Cadence:
    """How time is cut into periods. `custom` needs a length in days and an anchor date."""

    frequency: Frequency
    custom_days: int | None = None
    anchor: date | None = None

    def __post_init__(self) -> None:
        if self.frequency == Frequency.CUSTOM and (self.custom_days is None or self.anchor is None):
            raise ValueError("custom cadence needs custom_days and anchor")

    @property
    def average_days(self) -> Decimal:
        if self.frequency == Frequency.CUSTOM:
            return Decimal(self.custom_days or 1)
        return AVERAGE_DAYS[self.frequency]

    def containing(self, day: date) -> Period:
        match self.frequency:
            case Frequency.DAILY:
                return Period(day, day)
            case Frequency.WEEKLY:  # Monday to Sunday
                start = day - timedelta(days=day.weekday())
                return Period(start, start + timedelta(days=6))
            case Frequency.BIWEEKLY:
                return _fixed_length(day, 14, BIWEEKLY_ANCHOR)
            case Frequency.MONTHLY:
                last_day = calendar.monthrange(day.year, day.month)[1]
                return Period(day.replace(day=1), day.replace(day=last_day))
            case Frequency.CUSTOM:
                if self.custom_days is None or self.anchor is None:
                    raise ValueError("custom cadence needs custom_days and anchor")
                return _fixed_length(day, self.custom_days, self.anchor)

    def next(self, period: Period) -> Period:
        return self.containing(period.end + timedelta(days=1))

    def previous(self, period: Period) -> Period:
        return self.containing(period.start - timedelta(days=1))


def _fixed_length(day: date, length: int, anchor: date) -> Period:
    index = (day - anchor).days // length  # floor division: also right before the anchor
    start = anchor + timedelta(days=index * length)
    return Period(start, start + timedelta(days=length - 1))


def recurring_dates(
    frequency: Frequency,
    start: date,
    window: Period,
    *,
    custom_days: int | None = None,
    day_of_month: int | None = None,
) -> list[date]:
    """Every date in `window` on which something repeating from `start` happens.

    Monthly items fall on `day_of_month` (default: start's day), moved to the last day of
    shorter months (31 → 30 Apr, 28/29 Feb). Nothing happens before `start`.
    """
    if window.end < start:
        return []

    if frequency == Frequency.MONTHLY:
        target_day = day_of_month or start.day
        dates = []
        year, month = window.start.year, window.start.month
        while (year, month) <= (window.end.year, window.end.month):
            day = date(year, month, min(target_day, calendar.monthrange(year, month)[1]))
            if day >= start and day in window:
                dates.append(day)
            year, month = (year + 1, 1) if month == 12 else (year, month + 1)
        return dates

    step = {
        Frequency.DAILY: 1,
        Frequency.WEEKLY: 7,
        Frequency.BIWEEKLY: 14,
        Frequency.CUSTOM: custom_days,
    }[frequency]
    if not step:
        raise ValueError("custom frequency needs custom_days")
    # First repetition on or after the window start (ceil division)
    skipped = max(0, -(-(window.start - start).days // step))
    day = start + timedelta(days=skipped * step)
    dates = []
    while day <= window.end:
        dates.append(day)
        day += timedelta(days=step)
    return dates
