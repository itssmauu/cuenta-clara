"""The server's notion of "today", in one place so tests can pin it.

Callers use `clock.utc_today()` (through the module, not `from ... import`) so that
monkeypatching this function changes every caller.
"""

from datetime import UTC, date, datetime


def utc_today() -> date:
    return datetime.now(UTC).date()
