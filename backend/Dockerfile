FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Run as an unprivileged user, never as root
RUN groupadd --system app && useradd --system --gid app --no-create-home app

COPY pyproject.toml README.md ./
COPY app ./app
RUN pip install .

COPY alembic.ini ./
COPY alembic ./alembic

USER app
EXPOSE 8000

# Apply pending migrations, then serve. uvicorn must not rewrite the client address from
# X-Forwarded-For (the app picks the trusted entry itself: TRUSTED_PROXY_HOPS), and it
# does not need to announce itself in a Server header.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-proxy-headers --no-server-header"]
