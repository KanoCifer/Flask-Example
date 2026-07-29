"""Application-level service composition root.

(AppState == Go 端的 ``app.AppState`` — 启动一次、注入到 ``app.state.services``，
所有 router 通过 ``Depends(get_app_state)`` 获取 service 单例。)
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Request
from redis.asyncio import Redis as AsyncRedis

from app.core.agent import AiAgent
from app.plugins.notification import NotificationPlugin
from app.repositories import (
    DeviceRepo,
    FishingRepo,
    FriendLinkRepo,
    GalleryRepo,
    NotificationRepo,
    PublicRepo,
    RssRepo,
    SubRepo,
)
from app.repositories.user import UserRepo
from app.services.ai_service import AiService
from app.services.device_service import DeviceService
from app.services.fishing.fishing_service import FishingService
from app.services.friendlink_service import FriendLinkService
from app.services.gallery_service import GalleryService
from app.services.notification_service import NotificationService
from app.services.public_service import PublicService
from app.services.rss_service import RssService
from app.services.status_service import StatusService
from app.services.sub_service import SubService
from app.services.user import GitHubAuthService, PasskeyService, UserService
from app.services.weather_analysis_service import WeatherAnalysisService


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
    status_svc: StatusService
    gallery_svc: GalleryService
    weather_analysis_svc: WeatherAnalysisService
    rss_svc: RssService
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

    # -- services -------------------------------------------------------- #
    user_svc = UserService(repo=user_repo)
    passkey_svc = PasskeyService(user_service=user_svc)
    github_svc = GitHubAuthService(user_service=user_svc)
    from app.services.fishing.fishing_expert import FishingExpertScorer
    from app.services.fishing.fishing_model_service import FishingModelService

    ai_agent = AiAgent(expert_weights=FishingExpertScorer.WEIGHTS)
    ai_svc = AiService(agent=ai_agent)
    public_svc = PublicService(repo=public_repo)
    status_svc = StatusService(repo=public_repo)
    gallery_svc = GalleryService(gallery_repo=gallery_repo)
    rss_svc = RssService(repo=rss_repo, redis=redis)
    sub_svc = SubService(repo=sub_repo)
    notification_svc = NotificationService(
        plugin=NotificationPlugin(), repo=notification_repo
    )
    device_svc = DeviceService(repo=device_repo)
    friendlink_svc = FriendLinkService(repo=friendlink_repo)

    # 钓鱼模块：expert + model_svc 在此构造一次，注入到 FishingService
    # 和 WeatherAnalysisService，消除模块级单例（架构评审 issue#4）。
    fishing_expert = FishingExpertScorer()
    fishing_model_svc = FishingModelService()
    fishing_svc = FishingService(
        repo=fishing_repo,
        expert=fishing_expert,
        model_svc=fishing_model_svc,
    )
    weather_analysis_svc = WeatherAnalysisService(
        ai_agent=ai_agent,
        fishing_svc=fishing_svc,
    )

    return AppState(
        user_svc=user_svc,
        passkey_svc=passkey_svc,
        github_svc=github_svc,
        public_svc=public_svc,
        status_svc=status_svc,
        gallery_svc=gallery_svc,
        weather_analysis_svc=weather_analysis_svc,
        rss_svc=rss_svc,
        sub_svc=sub_svc,
        notification_svc=notification_svc,
        device_svc=device_svc,
        fishing_svc=fishing_svc,
        friendlink_svc=friendlink_svc,
        ai_svc=ai_svc,
    )


async def get_app_state(request: Request) -> AppState:
    """Return the AppState singleton mounted on ``app.state.services`` by lifespan."""
    return request.app.state.services
