from __future__ import annotations

from typing import Protocol, runtime_checkable

from pydantic import BaseModel


class Message(BaseModel):
    """通用通知消息 —— 只含文本，不含任何领域字段。

    Attributes:
        title: 消息标题。
        body: 纯文本正文（Bark / 飞书 markdown 渠道使用）。
        html: HTML 正文（Email 渠道使用）；为 ``None`` 时由渠道自行决定
            （如 Email 退化为转义后的 body）。
        color: 飞书卡片 header 模板色（blue / green / red / orange / yellow /
            violet / purple / indigo / turquoise / wathet / carmine / grey /
            default）；为 ``None`` 时 FeishuChannel 默认 "green"。其它渠道忽略。
    """

    title: str
    body: str
    html: str | None = None
    color: str | None = None


class NotificationContext(BaseModel):
    """渠道收件人配置 —— 纯传输层，不含业务 ID，不查库。

    调用方负责把 profile / reminder_config 等业务数据解析为这三个字段，
    本插件只管"拿着这些地址发消息"。缺省字段的渠道会直接返回 False，
    不做 DB 回退。
    """

    email: str | None = None
    feishu_webhook_url: str | None = None
    bark_device_key: str | None = None


@runtime_checkable
class NotificationChannel(Protocol):
    """传输 adapter seam —— 唯一通用方法。

    每个具体渠道（Bark / 飞书 / Email）实现此 Protocol，只负责把
    :class:`Message` 发到对应端点。配置校验下沉进 ``send`` 内部，
    不再单列 ``validate_config`` 抽象方法。
    """

    name: str

    async def send(self, message: Message, ctx: NotificationContext) -> bool:
        """发送一条消息到本渠道。返回是否成功。"""
        ...


class NotificationPlugin:
    """通知传输插件 —— 持有渠道注册表，提供 :func:`notify` 入口。

    渠道注册表可注入（便于测试注入 fake channel），缺省装配
    Bark / 飞书 / Email 三个内置渠道。
    """

    def __init__(
        self,
        channels: dict[str, NotificationChannel] | None = None,
    ) -> None:
        if channels is None:
            channels = self._default_channels()
        self._channels: dict[str, NotificationChannel] = channels

    @staticmethod
    def _default_channels() -> dict[str, NotificationChannel]:
        # 延迟导入，避免 plugin 层在 import 时强依赖各渠道的第三方库。
        from app.plugins.notification.channels.bark import BarkChannel
        from app.plugins.notification.channels.email import EmailChannel
        from app.plugins.notification.channels.feishu import FeishuChannel

        channel_list: list[NotificationChannel] = [
            BarkChannel(),
            FeishuChannel(),
            EmailChannel(),
        ]
        return {c.name: c for c in channel_list}

    def register(self, channel: NotificationChannel) -> None:
        """注册 / 覆盖一个渠道。"""
        self._channels[channel.name] = channel

    async def notify(
        self,
        channels: list[str],
        message: Message,
        ctx: NotificationContext,
    ) -> dict[str, bool]:
        """发送消息到多个渠道，返回每个渠道的成功与否。

        Args:
            channels: 需要发送的渠道名列表（如 ``["bark", "email"]``）。
            message: 通用通知消息。
            ctx: 渠道收件人配置。

        Returns:
            ``{渠道名: 是否成功}``。未知渠道或发送异常记为 ``False``，
            不影响其它渠道。
        """
        results: dict[str, bool] = {}
        for channel_name in channels:
            channel = self._channels.get(channel_name)
            if channel is None:
                results[channel_name] = False
                continue
            try:
                results[channel_name] = await channel.send(message, ctx)
            except Exception:
                # 单渠道失败不应阻断其它渠道；具体异常由渠道内部记录。
                results[channel_name] = False
        return results


async def notify(
    channels: list[str],
    message: Message,
    ctx: NotificationContext,
    plugin: NotificationPlugin | None = None,
) -> dict[str, bool]:
    """模块级便捷入口 —— 等价于 ``NotificationPlugin().notify(...)``。

    优先使用注入的 ``plugin``（测试可传入装配了 fake channel 的实例）；
    未提供时每次新建默认插件实例。生产路径应通过 DI 注入单例 plugin。
    """
    instance = plugin or NotificationPlugin()
    return await instance.notify(channels=channels, message=message, ctx=ctx)
