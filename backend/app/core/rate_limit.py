"""Rate limiting by client IP (slowapi) and by email address (limits).

Counters live in process memory: fine for a single API instance. With several
replicas, point both limiters at a shared store such as Redis.
"""

import math
import time

from fastapi import Request
from fastapi.responses import JSONResponse
from limits import parse
from limits.storage import MemoryStorage
from limits.strategies import MovingWindowRateLimiter
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

TOO_MANY_REQUESTS = "Demasiados intentos. Espera un momento antes de volver a intentarlo."

# Per IP. Behind a reverse proxy, run uvicorn with --proxy-headers so this sees the real IP.
limiter = Limiter(key_func=get_remote_address)

_email_storage = MemoryStorage()
_email_limiter = MovingWindowRateLimiter(_email_storage)


class EmailRateLimitedError(Exception):
    def __init__(self, retry_after: int) -> None:
        self.retry_after = retry_after


def check_email_rate_limit(scope: str, email: str, limit: str) -> None:
    """Count one attempt for this email; raise once it goes over `limit` (e.g. "10/hour")."""
    item = parse(limit)
    if not _email_limiter.hit(item, scope, email):
        reset_at, _ = _email_limiter.get_window_stats(item, scope, email)
        raise EmailRateLimitedError(retry_after=max(1, math.ceil(reset_at - time.time())))


def reset_rate_limits() -> None:
    """Clear every counter (used by tests)."""
    limiter.reset()
    _email_storage.reset()


def rate_limit_exceeded_handler(_request: Request, exc: Exception) -> JSONResponse:
    retry_after = exc.retry_after if isinstance(exc, EmailRateLimitedError) else 60
    if isinstance(exc, RateLimitExceeded):
        retry_after = exc.limit.limit.get_expiry()
    return JSONResponse(
        status_code=429,
        content={"detail": TOO_MANY_REQUESTS},
        headers={"Retry-After": str(retry_after)},
    )
