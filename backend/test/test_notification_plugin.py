"""通用通知插件单测 —— 聚焦 notify() 入口行为，注入 fake channel。"""

import pytest

from app.plugins.notification import (
    Message,
    NotificationChannel,
    NotificationContext,
    NotificationPlugin,
    notify,
)


class _FakeChannel:
    """可编程的 fake 传输 adapter，记录调用、可控成功/失败。"""

    def __init__(
        self,
        name: str,
        succeed: bool = True,
        raise_exc: Exception | None = None,
    ) -> None:
        self.name = name
        self.succeed = succeed
        self.raise_exc = raise_exc
        self.calls: list[tuple[Message, NotificationContext]] = []

    async def send(self, message: Message, ctx: NotificationContext) -> bool:
        self.calls.append((message, ctx))
        if self.raise_exc is not None:
            raise self.raise_exc
        return self.succeed


@pytest.fixture
def ctx() -> NotificationContext:
    return NotificationContext(email="u@x.com")


@pytest.fixture
def message() -> Message:
    return Message(title="t", body="b")


def _plugin(*channels: _FakeChannel) -> NotificationPlugin:
    return NotificationPlugin({c.name: c for c in channels})


@pytest.mark.asyncio
async def test_notify_unknown_channel_returns_false(ctx, message):
    plugin = _plugin(_FakeChannel("bark"))
    results = await plugin.notify(["nonexistent"], message, ctx)
    assert results == {"nonexistent": False}


@pytest.mark.asyncio
async def test_notify_routes_message_to_correct_channels(ctx, message):
    bark = _FakeChannel("bark")
    email = _FakeChannel("email")
    plugin = _plugin(bark, email)

    results = await plugin.notify(["bark", "email"], message, ctx)

    assert results == {"bark": True, "email": True}
    assert bark.calls and bark.calls[0][0] is message
    assert email.calls and email.calls[0][1] is ctx


@pytest.mark.asyncio
async def test_notify_failure_does_not_block_other_channels(ctx, message):
    bark = _FakeChannel("bark", succeed=False)
    email = _FakeChannel("email", succeed=True)
    plugin = _plugin(bark, email)

    results = await plugin.notify(["bark", "email"], message, ctx)

    assert results == {"bark": False, "email": True}


@pytest.mark.asyncio
async def test_notify_channel_exception_recorded_as_false(ctx, message):
    bark = _FakeChannel("bark", raise_exc=RuntimeError("boom"))
    email = _FakeChannel("email")
    plugin = _plugin(bark, email)

    results = await plugin.notify(["bark", "email"], message, ctx)

    assert results == {"bark": False, "email": True}


@pytest.mark.asyncio
async def test_module_level_notify_uses_injected_plugin(ctx, message):
    fake = _FakeChannel("bark")
    plugin = _plugin(fake)

    results = await notify(["bark"], message, ctx, plugin=plugin)

    assert results == {"bark": True}
    assert fake.calls


def test_message_and_context_are_pydantic():
    msg = Message(title="t", body="b", html="<p>b</p>", color="red")
    ctx = NotificationContext(email="a@b.com")
    assert msg.model_dump() == {
        "title": "t",
        "body": "b",
        "html": "<p>b</p>",
        "color": "red",
    }
    assert ctx.email == "a@b.com"


def test_message_color_default_none():
    msg = Message(title="t", body="b")
    assert msg.color is None


def test_fake_channel_satisfies_protocol():
    # runtime_checkable Protocol: 实例应被识别为 NotificationChannel
    assert isinstance(_FakeChannel("bark"), NotificationChannel)
