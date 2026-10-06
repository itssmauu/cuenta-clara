from datetime import date

import pytest

from app.models import Frequency
from app.services.periods import Cadence, Period, recurring_dates

WEDNESDAY = date(2026, 10, 7)


@pytest.mark.parametrize(
    ("cadence", "expected"),
    [
        (Cadence(Frequency.DAILY), Period(WEDNESDAY, WEDNESDAY)),
        (Cadence(Frequency.WEEKLY), Period(date(2026, 10, 5), date(2026, 10, 11))),
        (Cadence(Frequency.BIWEEKLY), Period(date(2026, 10, 5), date(2026, 10, 18))),
        (Cadence(Frequency.MONTHLY), Period(date(2026, 10, 1), date(2026, 10, 31))),
        (
            Cadence(Frequency.CUSTOM, custom_days=10, anchor=date(2026, 10, 1)),
            Period(date(2026, 10, 1), date(2026, 10, 10)),
        ),
    ],
)
def test_period_containing_a_day(cadence: Cadence, expected: Period) -> None:
    assert cadence.containing(WEDNESDAY) == expected


def test_next_and_previous_periods() -> None:
    monthly = Cadence(Frequency.MONTHLY)
    february = monthly.containing(date(2028, 2, 10))

    assert february == Period(date(2028, 2, 1), date(2028, 2, 29))  # leap year
    assert monthly.next(february) == Period(date(2028, 3, 1), date(2028, 3, 31))
    assert monthly.previous(february) == Period(date(2028, 1, 1), date(2028, 1, 31))


def test_custom_periods_before_the_anchor() -> None:
    cadence = Cadence(Frequency.CUSTOM, custom_days=10, anchor=date(2026, 10, 1))

    assert cadence.containing(date(2026, 9, 25)) == Period(date(2026, 9, 21), date(2026, 9, 30))


def test_custom_cadence_requires_days_and_anchor() -> None:
    with pytest.raises(ValueError, match="custom"):
        Cadence(Frequency.CUSTOM)


def test_weekly_recurring_dates() -> None:
    october = Period(date(2026, 10, 1), date(2026, 10, 31))

    dates = recurring_dates(Frequency.WEEKLY, date(2026, 9, 28), october)

    assert dates == [date(2026, 10, d) for d in (5, 12, 19, 26)]


def test_nothing_happens_before_the_start_date() -> None:
    october = Period(date(2026, 10, 1), date(2026, 10, 31))

    assert recurring_dates(Frequency.DAILY, date(2026, 10, 30), october) == [
        date(2026, 10, 30),
        date(2026, 10, 31),
    ]
    assert recurring_dates(Frequency.DAILY, date(2026, 11, 1), october) == []


def test_monthly_dates_move_to_the_end_of_short_months() -> None:
    year = Period(date(2026, 1, 1), date(2026, 4, 30))

    dates = recurring_dates(Frequency.MONTHLY, date(2026, 1, 1), year, day_of_month=31)

    assert dates == [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)]


def test_monthly_dates_default_to_the_start_day() -> None:
    window = Period(date(2026, 10, 1), date(2026, 12, 31))

    dates = recurring_dates(Frequency.MONTHLY, date(2026, 10, 20), window)

    assert dates == [date(2026, 10, 20), date(2026, 11, 20), date(2026, 12, 20)]


def test_custom_recurring_dates() -> None:
    window = Period(date(2026, 10, 1), date(2026, 10, 31))

    dates = recurring_dates(Frequency.CUSTOM, date(2026, 9, 25), window, custom_days=10)

    assert dates == [date(2026, 10, 5), date(2026, 10, 15), date(2026, 10, 25)]
