"""Pydantic schemas package.

This package re-exports all schemas for convenient importing.
Use ``from app.schemas import <SchemaName>`` or import from sub-modules directly.
"""

from app.schemas.aiagent import (
    HistoryRequest,
    SummaryInput,
    ThreadRequest,
)
from app.schemas.auth import (
    EmailCodeIn,
    EmailSchema,
    GitHubOAuthConfig,
    LoginIn,
    LoginOut,
    PasskeyAuthRequest,
    PasskeyRegistrationRequest,
    RegisterIn,
    RegisterOut,
)
from app.schemas.email import BootstrapEmailContent, EmailCodeContent
from app.schemas.feishu import FeishuMessageContent, FeishuRichTextContent
from app.schemas.rss import (
    RssArticleListResponse,
    RssArticleResponse,
    RssMarkReadRequest,
    RssRequest,
    RssSubscriptionResponse,
)
from app.schemas.user import (
    ImageUploadOut,
    UserOut,
    UserProfileOut,
    UserSettingsIn,
    UserSettingsOut,
)
__all__ = [
    "BootstrapEmailContent",
    "EmailCodeContent",
    "EmailCodeIn",
    "EmailSchema",
    "FeishuMessageContent",
    "FeishuRichTextContent",
    "GitHubOAuthConfig",
    "HistoryRequest",
    "ImageUploadOut",
    "LoginIn",
    "LoginOut",
    "PasskeyAuthRequest",
    "PasskeyRegistrationRequest",
    "RegisterIn",
    "RegisterOut",
    "RssArticleListResponse",
    "RssArticleResponse",
    "RssMarkReadRequest",
    "RssRequest",
    "RssSubscriptionResponse",
    "SummaryInput",
    "ThreadRequest",
    "UserOut",
    "UserProfileOut",
    "UserSettingsIn",
    "UserSettingsOut",
]
