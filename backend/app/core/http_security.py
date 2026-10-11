"""HTTP-level protections: security headers and CSRF (double-submit cookie)."""

import secrets
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings

CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
# Endpoints that start a session: there is no CSRF cookie yet when they are called
CSRF_EXEMPT_PATHS = frozenset(
    {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        # Password recovery: by definition there is no session (nor CSRF cookie) yet
        "/api/v1/auth/password/forgot",
        "/api/v1/auth/password/reset",
    }
)

# The API only returns JSON, so it never needs to load scripts, styles or frames
API_CSP = "default-src 'none'; frame-ancestors 'none'"
DOCS_PATHS = ("/docs", "/openapi.json")

CallNext = Callable[[Request], Awaitable[Response]]

PROXY_SECRET_HEADER = "X-Proxy-Secret"  # noqa: S105 - a header name, not a secret
# Uptime checks may call it directly; it says nothing about anyone
GATE_EXEMPT_PATHS = frozenset({"/api/v1/health"})


class ProxyGateMiddleware(BaseHTTPMiddleware):
    """With PROXY_SECRET set, only the web app's proxy can use the API.

    On Vercel the API has a public URL of its own. Without this, anyone could call it
    directly, skipping the web app and claiming any visitor IP. Unknown callers get the
    same 404 as a missing page, so the API does not even reveal that it exists.
    """

    async def dispatch(self, request: Request, call_next: CallNext) -> Response:
        secret = get_settings().proxy_secret
        if secret is not None and request.url.path not in GATE_EXEMPT_PATHS:
            sent = request.headers.get(PROXY_SECRET_HEADER, "")
            if not secrets.compare_digest(sent.encode(), secret.get_secret_value().encode()):
                return JSONResponse(status_code=404, content={"detail": "No encontrado."})
        return await call_next(request)


class CSRFMiddleware(BaseHTTPMiddleware):
    """Reject state-changing requests whose X-CSRF-Token header doesn't match the cookie.

    A malicious site can make the browser *send* our cookies, but it cannot *read*
    them, so it can't copy the cookie value into the header.
    """

    async def dispatch(self, request: Request, call_next: CallNext) -> Response:
        if request.method not in SAFE_METHODS and request.url.path not in CSRF_EXEMPT_PATHS:
            cookie = request.cookies.get(CSRF_COOKIE, "")
            header = request.headers.get(CSRF_HEADER, "")
            if not cookie or not secrets.compare_digest(cookie, header):
                return JSONResponse(
                    status_code=403, content={"detail": "Token CSRF inválido o ausente."}
                )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: object, *, hsts: bool) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self.hsts = hsts

    async def dispatch(self, request: Request, call_next: CallNext) -> Response:
        response = await call_next(request)
        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "no-referrer")
        headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        # Financial data must not be stored by browsers or intermediate caches
        headers.setdefault("Cache-Control", "no-store")
        # Swagger UI loads its own assets, so it keeps the default policy
        if not request.url.path.startswith(DOCS_PATHS):
            headers.setdefault("Content-Security-Policy", API_CSP)
        if self.hsts:
            headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        return response
