from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from app.api.router import api_router
from app.core.config import get_settings
from app.core.http_security import CSRF_HEADER, CSRFMiddleware, SecurityHeadersMiddleware
from app.core.logging import configure_logging
from app.core.rate_limit import EmailRateLimitedError, limiter, rate_limit_exceeded_handler


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        # Interactive docs are handy locally but expose the API surface in production
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    app.add_exception_handler(EmailRateLimitedError, rate_limit_exceeded_handler)

    # Middleware added last runs first. CORS is outermost so even CSRF rejections
    # carry CORS headers and the frontend can read the error.
    app.add_middleware(CSRFMiddleware)
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", CSRF_HEADER],
    )

    app.include_router(api_router)
    return app


app = create_app()
