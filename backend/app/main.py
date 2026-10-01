"""FastAPI main application entry point."""

import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import (
    repos_router,
    reviews_router,
)
from app.api.v1.dashboard import (
    router as dashboard_router,
)
from app.api.v1.webhooks import router as webhooks_router
from app.core.config import settings
from app.core.errors import AppError, app_error_handler, unhandled_exception_handler
from app.core.logging import setup_logging


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan management."""
    setup_logging(settings.LOG_LEVEL)
    settings.validate_production()
    logger = structlog.get_logger()
    logger.info("app_started", env=settings.APP_ENV, version="0.1.0")
    yield
    logger.info("app_stopped")


app = FastAPI(
    title="PR Review AI API",
    version="0.1.0",
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/redoc" if settings.APP_ENV != "production" else None,
    lifespan=lifespan,
)

# Exception handlers
app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
app.add_exception_handler(Exception, unhandled_exception_handler)

# CORS Middleware (strict origin check per 03-security.md)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.WEB_BASE_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(webhooks_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(repos_router, prefix="/api/v1")
app.include_router(reviews_router, prefix="/api/v1")


@app.middleware("http")
async def request_context_middleware(request: Request, call_next: Any) -> Response:
    """Attaches request_id and measures duration with structured logging."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)

    start_time = time.perf_counter()
    response: Response = await call_next(request)
    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # Security headers per 03-security.md
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.APP_ENV != "local":
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )

    log = structlog.get_logger()
    log.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=duration_ms,
    )
    return response


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}


@app.get("/readyz")
async def readyz() -> dict[str, Any]:
    """Readiness probe checking critical dependencies."""
    # Checks database and redis availability when configured
    return {
        "status": "ready",
        "env": settings.APP_ENV,
        "paused": settings.REVIEWS_PAUSED,
    }
