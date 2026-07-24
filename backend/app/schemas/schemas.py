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
from app.schemas.blog import (
    BlogIn,
    BlogPostDelete,
    BlogPostGet,
    BlogPostIn,
    BlogPostUpdate,
    PostsByTagOut,
    TagItem,
    TagsOut,
)
from app.schemas.devtask import DevTaskCreate, DevTaskOut, DevTaskUpdate
from app.schemas.email import BootstrapEmailContent, EmailCodeContent
from app.schemas.feishu import FeishuMessageContent, FeishuRichTextContent
from app.schemas.moment import (
    MomentAttachmentIn,
    MomentAttachmentOut,
    MomentCreate,
    MomentListOut,
    MomentLocationIn,
    MomentLocationOut,
    MomentOut,
    MomentUpdate,
)
from app.schemas.pagination import PaginationSchema
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
    "BlogIn",
    "BlogPostDelete",
    "BlogPostGet",
    "BlogPostIn",
    "BlogPostUpdate",
    "BootstrapEmailContent",
    "DevTaskCreate",
    "DevTaskOut",
    "DevTaskUpdate",
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
    "MomentAttachmentIn",
    "MomentAttachmentOut",
    "MomentCreate",
    "MomentListOut",
    "MomentLocationIn",
    "MomentLocationOut",
    "MomentOut",
    "MomentUpdate",
    "PaginationSchema",
    "PasskeyRegistrationRequest",
    "PostsByTagOut",
    "RegisterIn",
    "RegisterOut",
    "RssArticleListResponse",
    "RssArticleResponse",
    "RssMarkReadRequest",
    "RssRequest",
    "RssSubscriptionResponse",
    "SummaryInput",
    "TagItem",
    "TagsOut",
    "ThreadRequest",
    "UserOut",
    "UserProfileOut",
    "UserSettingsIn",
    "UserSettingsOut",
]
