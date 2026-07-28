"""Backward-compatible re-export module.

All schemas are now defined in individual sub-modules.
This module re-exports everything so that
``from app.schemas.schemas import ...`` continues to work.
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
