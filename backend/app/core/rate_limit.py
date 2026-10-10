"""Rate limiting by client IP (slowapi) and by email address (limits).

Counters live in process memory: fine for a single API instance. With several
replicas, point both limiters at a shared store such as Redis.

Which IP? Next.js forwards X-Forwarded-For untouched and never adds the visitor's
address, so the header holds whatever the client wrote plus one entry per proxy in
front (each appends the address it saw). Only the entries those proxies appended are
trustworthy: the client IP is the TRUSTED_PROXY_HOPS-th entry from the right.
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

from app.core.config import get_settings

TOO_MANY_REQUESTS = "Demasiados intentos. Espera un momento antes de volver a intentarlo."


def client_ip(request: Request) -> str:
    """The visitor's address, as seen by our own proxies (never as claimed by the client)."""
    peer = request.client.host if request.client else "unknown"
    hops = get_settings().trusted_proxy_hops
    if hops == 0:
        return peer
    forwarded = [
        entry.strip()
        for header in request.headers.getlist("x-forwarded-for")
        for entry in header.split(",")
        if entry.strip()
    ]
    # Each trusted proxy appended one entry; anything further left came from the client
    return forwarded[-hops] if len(forwarded) >= hops else peer


# Per IP
limiter = Limiter(key_func=client_ip)

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
