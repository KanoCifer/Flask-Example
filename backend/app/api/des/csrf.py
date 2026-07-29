"""CSRF Token dependency module.

Provides CSRF Token generation and verification based on itsdangerous library.

Usage:
    from app.api.des.csrf import csrf_protect, get_csrf_token

    # Get CSRF Token
    @router.get("/csrf-token")
    async def csrf_token(csrf: str = Depends(get_csrf_token)):
        return {"csrf_token": csrf}

    # Protected endpoint
    @router.post("/protected", dependencies=[Depends(csrf_protect)])
    async def protected_endpoint(...):
        ...
"""

from __future__ import annotations

import secrets
from typing import TYPE_CHECKING

from fastapi import Cookie, Depends, HTTPException, Request, Response, status
from itsdangerous import SignatureExpired, TimestampSigner

from app.core.config import settings
from app.core.exceptions import APIError

if TYPE_CHECKING:
    from fastapi import FastAPI


class CSRFManager:
    """CSRF Token manager.

    Uses itsdangerous signing mechanism to generate and verify CSRF tokens,
    tokens include timestamp signature to prevent CSRF attacks.
    """

    def __init__(self, secret_key: str | None = None):
        self._secret = secret_key or settings.SECRET_KEY
        if not self._secret:
            raise ValueError("CSRF_SECRET_KEY must be configured")

        self._signer = TimestampSigner(self._secret)

        self.cookie_name = "csrf_token"
        self.header_name = "X-CSRF-Token"
        self.token_ttl = 3600

    def generate_token(self) -> str:
        random_token = secrets.token_urlsafe(32)
        signed = self._signer.sign(random_token.encode())
        return signed.decode()

    def verify_token(self, token: str) -> bool:
        try:
            self._signer.unsign(token, max_age=self.token_ttl)
            return True
        except SignatureExpired, Exception:
            return False

    def set_csrf_cookie(self, response: Response) -> str:
        token = self.generate_token()
        response.set_cookie(
            key=self.cookie_name,
            value=token,
            httponly=False,
            samesite="lax",
            max_age=self.token_ttl,
            secure=settings.CSRF_COOKIE_SECURE,
        )
        return token

    def get_token_from_cookie(self, request: Request) -> str | None:
        return request.cookies.get(self.cookie_name)


csrf_manager = CSRFManager()


async def get_csrf_token(response: Response | None = None) -> str:
    return csrf_manager.generate_token()


async def csrf_token_dependency(
    request: Request,
    response: Response,
    csrf_from_cookie: str | None = Cookie(None, alias="csrf_token"),
    csrf_from_header: str | None = None,
) -> str:
    client_token = csrf_from_header or csrf_from_cookie

    if not client_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing",
        )

    if not csrf_manager.verify_token(client_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token invalid or expired",
        )

    return client_token


csrf_protect = Depends(csrf_token_dependency)


def setup_csrf(app: FastAPI) -> None:
    @app.middleware("http")
    async def csrf_middleware(request: Request, call_next):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)

        skip_paths = [
            "/v1/public/like",
            "/v1/public/set-pic-gallery",
            "/v2/fishing/feedback",
        ]

        if any(request.url.path.startswith(path) for path in skip_paths):
            return await call_next(request)

        csrf_from_cookie = request.cookies.get(csrf_manager.cookie_name)
        csrf_from_header = request.headers.get(csrf_manager.header_name)

        client_token = csrf_from_header or csrf_from_cookie

        if not client_token or not csrf_manager.verify_token(client_token):
            raise APIError(
                message="CSRF token missing or invalid",
                code=status.HTTP_403_FORBIDDEN,
            )

        return await call_next(request)
