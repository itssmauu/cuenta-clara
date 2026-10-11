"""Rate limiting by client IP (slowapi) and by email address (limits).

Counters live in RATE_LIMIT_STORAGE_URI: process memory by default (one server), Redis
on serverless platforms or with several instances, so every instance sees the same count.

Which IP?
- With PROXY_SECRET (Vercel): the web app's proxy sends the visitor's address in
  X-Client-IP, taken from the platform, never from the client. Only requests carrying
  the secret reach the API at all (see ProxyGateMiddleware), so nobody else can set it.
- Otherwise: Next.js forwards X-Forwarded-For untouched and never adds the visitor's
  address, so the header holds whatever the client wrote plus one entry per proxy in
  front. Only the TRUSTED_PROXY_HOPS-th entry from the right is trustworthy.
"""

import ipaddress
import math
import time

from fastapi import Request
from fastapi.responses import JSONResponse
from limits import parse
from limits.storage import Storage, storage_from_string
from limits.strategies import MovingWindowRateLimiter
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings

TOO_MANY_REQUESTS = "Demasiados intentos. Espera un momento antes de volver a intentarlo."


CLIENT_IP_HEADER = "X-Client-IP"


def _valid_ip(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return False
    return True


def client_ip(request: Request) -> str:
    """The visitor's address, as seen by our own proxies (never as claimed by the client)."""
    peer = request.client.host if request.client else "unknown"
    settings = get_settings()
    if settings.proxy_secret is not None:
        # The gate already rejected anything without the secret: only our proxy got here
        sent = request.headers.get(CLIENT_IP_HEADER, "").strip()
        return sent if _valid_ip(sent) else peer
    hops = settings.trusted_proxy_hops
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


_storage_uri = get_settings().rate_limit_storage_uri
# Per IP (slowapi keeps its own connection to the same store)
limiter = Limiter(key_func=client_ip, storage_uri=_storage_uri)
# Per email address and per user (Balbo); created lazily, so a Redis URL is only
# contacted when a limit is actually checked
shared_storage: Storage = storage_from_string(_storage_uri)
_email_limiter = MovingWindowRateLimiter(shared_storage)


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
    shared_storage.reset()


def rate_limit_exceeded_handler(_request: Request, exc: Exception) -> JSONResponse:
    retry_after = exc.retry_after if isinstance(exc, EmailRateLimitedError) else 60
    if isinstance(exc, RateLimitExceeded):
        retry_after = exc.limit.limit.get_expiry()
    return JSONResponse(
        status_code=429,
        content={"detail": TOO_MANY_REQUESTS},
        headers={"Retry-After": str(retry_after)},
    )
