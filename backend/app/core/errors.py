"""Standardized error responses and exceptions."""

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base application exception with error code and status."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Any = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class UnauthorizedError(AppError):
    """Authentication required or invalid."""

    def __init__(self, message: str = "Authentication required"):
        super().__init__(code="UNAUTHORIZED", message=message, status_code=401)


class ForbiddenError(AppError):
    """Action forbidden."""

    def __init__(self, message: str = "Permission denied"):
        super().__init__(code="FORBIDDEN", message=message, status_code=403)


class NotFoundError(AppError):
    """Resource not found."""

    def __init__(self, message: str = "Resource not found"):
        super().__init__(code="NOT_FOUND", message=message, status_code=404)


class RateLimitError(AppError):
    """Rate limit exceeded."""

    def __init__(self, message: str = "Rate limit exceeded", retry_after: int = 60):
        super().__init__(code="RATE_LIMITED", message=message, status_code=429)
        self.retry_after = retry_after


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    """Format AppError into standard { error: { code, message } } response."""
    headers = {}
    if isinstance(exc, RateLimitError):
        headers["Retry-After"] = str(exc.retry_after)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
        headers=headers,
    )


async def unhandled_exception_handler(
    _request: Request, exc: Exception
) -> JSONResponse:
    """Mask unexpected internal errors from clients for security."""
    import traceback

    print("UNHANDLED EXCEPTION IN BACKEND:", exc)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": f"Server error: {str(exc)}",
            }
        },
    )
