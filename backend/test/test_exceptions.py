"""Unit tests for app.core.exceptions — error classes and envelope shape."""

from __future__ import annotations

import pytest

from app.core.exceptions import (
    APIError,
    ForbiddenError,
    NotFoundError,
    RssDomainError,
    UnauthorizedError,
    ValidationError,
    WeatherDomainError,
)


def test_apierror_default_code():
    err = APIError("something went wrong")
    assert err.code == 500
    assert err.message == "something went wrong"
    assert err.errors == {}
    assert err.status_code == 500


def test_apierror_custom_code_and_errors():
    err = APIError("bad", code=400, errors={"field": "required"})
    assert err.code == 400
    assert err.errors == {"field": "required"}


@pytest.mark.parametrize(
    ("cls", "expected_code"),
    [
        (UnauthorizedError, 401),
        (ForbiddenError, 403),
        (NotFoundError, 404),
        (ValidationError, 422),
    ],
)
def test_http_semantic_errors_default_code(cls, expected_code):
    err = cls()
    assert err.code == expected_code
    assert err.status_code == expected_code


@pytest.mark.parametrize(
    "cls",
    [
        RssDomainError,
        WeatherDomainError,
    ],
)
def test_domain_errors_inherit_api_error(cls):
    err = cls("domain failure")
    assert isinstance(err, APIError)
    assert err.message == "domain failure"
    assert err.code == 500


def test_unauthorized_custom_message():
    err = UnauthorizedError("token expired")
    assert err.code == 401
    assert err.message == "token expired"


def test_validation_error_with_errors_dict():
    err = ValidationError(
        "schema validation failed",
        errors={"email": "invalid format"},
    )
    assert err.code == 422
    assert err.errors == {"email": "invalid format"}
