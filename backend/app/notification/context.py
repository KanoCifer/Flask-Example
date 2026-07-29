"""NotificationContext 构造器 —— 业务层的 config 解析桥接。

把 reminder_config（dict）和 user_id 解析为通用传输插件所需的
:class:`NotificationContext`，承担原 channel 内部的 Profile DB 回退逻辑。

通过 :class:`ProfilePort` 注入 Profile 查询能力，避免本模块直接依赖
SQLAlchemy 会话工厂（修复架构评审 issue#3 的层级穿透）。
"""

from __future__ import annotations

from app.notification.ports import DbProfilePort, ProfilePort
from app.plugins.notification import NotificationContext

# 模块级默认端口实例 —— 延迟到首次调用时才创建，避免 import 时强依赖 DB。
_default_port: ProfilePort | None = None


def _get_default_port() -> ProfilePort:
    """懒加载默认 DB 端口；生产路径使用。"""
    global _default_port
    if _default_port is None:
        _default_port = DbProfilePort()
    return _default_port


async def context_from_config(
    user_id: int,
    config: dict,
    profile_port: ProfilePort | None = None,
) -> NotificationContext:
    """从 reminder_config 构造 NotificationContext。

    优先级：config 字段 > Profile DB 回退。

    - email: config["email"] → Profile.email
    - feishu_webhook_url: config["feishu_webhook_url"]（无 DB 回退；
      真正发送时 feishu channel 还会用 settings.FEISHU_WEBHOOK_URL 兜底）
    - bark_device_key: config["bark_device_key"] → Profile.bark_device_key

    Args:
        user_id: 当前用户 ID。
        config: reminder_config 字典。
        profile_port: 可选的 Profile 查询端口。生产环境不传时使用
            :class:`DbProfilePort`（查 Postgres）；测试时注入 fake。
    """
    email = config.get("email")
    bark_key = config.get("bark_device_key")
    feishu_url = config.get("feishu_webhook_url")

    # 任一缺失 → 查 Profile
    if not email or not bark_key:
        port = profile_port or _get_default_port()
        profile = await port.get_profile(user_id)
        if profile and not email:
            email = profile.email
        if profile and not bark_key:
            bark_key = getattr(profile, "bark_device_key", None)

    return NotificationContext(
        email=email,
        feishu_webhook_url=feishu_url,
        bark_device_key=bark_key,
    )
