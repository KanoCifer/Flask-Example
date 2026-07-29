"""Custom exceptions and error handling for FastAPI application."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

# ============================================================================
# Base + HTTP Semantic Exceptions
# ============================================================================


class APIError(HTTPException):
    """Base API error class.

    Attributes:
        message: Error message
        code: HTTP status code
        errors: Additional error details (e.g., validation errors)
    """

    def __init__(
        self,
        message: str,
        code: int = 500,
        errors: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(status_code=code)
        self.message = message
        self.code = code
        self.errors = errors or {}


class UnauthorizedError(APIError):
    def __init__(self, message: str = "Unauthorized", **kwargs: Any) -> None:
        super().__init__(message=message, code=401, **kwargs)


class ForbiddenError(APIError):
    def __init__(self, message: str = "Forbidden", **kwargs: Any) -> None:
        super().__init__(message=message, code=403, **kwargs)


class NotFoundError(APIError):
    def __init__(
        self, message: str = "Resource not found", **kwargs: Any
    ) -> None:
        super().__init__(message=message, code=404, **kwargs)


class ValidationError(APIError):
    def __init__(
        self,
        message: str = "Validation failed",
        errors: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(message=message, code=422, errors=errors, **kwargs)


class GitHubAuthError(Exception):
    """GitHub OAuth flow error — carries an error_code for the frontend redirect."""

    def __init__(self, error_code: str) -> None:
        self.error_code = error_code
        super().__init__(error_code)


# ============================================================================
# Domain Errors — marker subclasses per service, auto routed by APIError handler
# ============================================================================


class WeatherDomainError(APIError):
    pass


class RssDomainError(APIError):
    pass


# ============================================================================
# Response Helper + Exception Handlers
# ============================================================================


def _create_error_response(
    message: str,
    errors: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "message": message,
        "data": errors if errors is not None else {},
    }


async def _http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_create_error_response(message=exc.detail),
    )


async def _validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors: dict[str, str] = {}
    for error in exc.errors():
        loc = ".".join(str(x) for x in error.get("loc", []))
        msg = error.get("msg", "")
        errors[loc or "general"] = msg
    return JSONResponse(
        status_code=422,
        content=_create_error_response(
            message="Validation failed",
            errors=errors,
        ),
    )


async def _api_exception_handler(
    request: Request, exc: APIError
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.code,
        content=_create_error_response(
            message=exc.message,
            errors=exc.errors or None,
        ),
    )


async def _generic_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=_create_error_response(message="Internal server error"),
    )


# ============================================================================
# Register
# ============================================================================


def register_exception_handlers(app: Any) -> None:
    """Register all exception handlers with the FastAPI application."""
    app.add_exception_handler(HTTPException, _http_exception_handler)
    app.add_exception_handler(
        RequestValidationError, _validation_exception_handler
    )
    app.add_exception_handler(
        ResponseValidationError, _validation_exception_handler
    )
    app.add_exception_handler(APIError, _api_exception_handler)
    app.add_exception_handler(Exception, _generic_exception_handler)
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore
