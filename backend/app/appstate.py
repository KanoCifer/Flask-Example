"""Application-level service composition root.

(AppState == Go 端的 ``app.AppState`` — 启动一次、注入到 ``app.state.services``，
所有 router 通过 ``Depends(get_app_state)`` 获取 service 单例。)
"""

from __future__ import annotations

from dataclasses import dataclass

from redis.asyncio import Redis as AsyncRedis

from app.core.agent import AiAgent
from app.plugins.cache import redis_cache
from app.plugins.notification import NotificationPlugin
from app.repositories import (
    DeviceRepo,
    FishingRepo,
    FriendLinkRepo,
    GalleryRepo,
    LogRepo,
    NotificationRepo,
    PublicRepo,
    RssRepo,
    SubRepo,
    WereadRepo,
)
from app.repositories.user import UserRepo
from app.services.ai_service import AiService
from app.services.device_service import DeviceService
from app.services.fishing.fishing_service import FishingService
from app.services.friendlink_service import FriendLinkService
from app.services.notification_service import NotificationService
from app.services.public_service import PublicService
from app.services.rss_service import RssService
from app.services.sub_service import SubService
from app.services.user import GitHubAuthService, PasskeyService, UserService
from app.services.weread import WereadService


@dataclass
class AppState:
    """Service singleton container.

    Session-free: all ``session: AsyncSession`` lives on the *method* level
    (请求级 ``Depends(get_session)``), never here.
    """

    user_svc: UserService
    passkey_svc: PasskeyService
    github_svc: GitHubAuthService
    public_svc: PublicService
    rss_svc: RssService
    weread_svc: WereadService
    sub_svc: SubService
    notification_svc: NotificationService
    device_svc: DeviceService
    fishing_svc: FishingService
    friendlink_svc: FriendLinkService
    ai_svc: AiService


def new_app_state(redis: AsyncRedis) -> AppState:
    """Construct all service singletons (called once at startup)."""

    # -- repos (session-free) ------------------------------------------- #
    user_repo = UserRepo()
    public_repo = PublicRepo()
    gallery_repo = GalleryRepo()
    rss_repo = RssRepo()
    sub_repo = SubRepo()
    notification_repo = NotificationRepo()
    device_repo = DeviceRepo()
    fishing_repo = FishingRepo()
    friendlink_repo = FriendLinkRepo()
    weread_repo = WereadRepo()
    log_repo = LogRepo()  # noqa: F841 — reserved for future use

    # -- services -------------------------------------------------------- #
    user_svc = UserService(repo=user_repo)
    passkey_svc = PasskeyService(user_service=user_svc)
    github_svc = GitHubAuthService(user_service=user_svc)
    from app.services.fishing.fishing_expert import FishingExpertScorer

    ai_agent = AiAgent(expert_weights=FishingExpertScorer.WEIGHTS)
    ai_svc = AiService(agent=ai_agent)
    public_svc = PublicService(
        repo=public_repo, gallery_repo=gallery_repo, ai_agent=ai_agent
    )
    rss_svc = RssService(repo=rss_repo, redis=redis)
    weread_svc = WereadService(repo=weread_repo)
    sub_svc = SubService(repo=sub_repo)
    notification_svc = NotificationService(
        plugin=NotificationPlugin(), repo=notification_repo
    )
    device_svc = DeviceService(repo=device_repo)
    fishing_svc = FishingService(repo=fishing_repo)
    friendlink_svc = FriendLinkService(repo=friendlink_repo)

    return AppState(
        user_svc=user_svc,
        passkey_svc=passkey_svc,
        github_svc=github_svc,
        public_svc=public_svc,
        rss_svc=rss_svc,
        weread_svc=weread_svc,
        sub_svc=sub_svc,
        notification_svc=notification_svc,
        device_svc=device_svc,
        fishing_svc=fishing_svc,
        friendlink_svc=friendlink_svc,
        ai_svc=ai_svc,
    )
