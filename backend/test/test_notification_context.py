"""Unit tests for notification context construction — verifies issue#3 fix.

The ``context_from_config`` function should no longer depend directly on
SQLAlchemy or ``get_async_session``; instead it accepts a ``ProfilePort``
that can be faked in tests without a database.
"""

from __future__ import annotations

import pytest

from app.models.models import Profile
from app.notification.context import context_from_config
from app.notification.ports import ProfilePort
from app.plugins.notification import NotificationContext


class FakeProfilePort:
    """Test double for ProfilePort — no database required."""

    def __init__(self, profile: Profile | None) -> None:
        self._profile = profile
        self.calls: list[int] = []

    async def get_profile(self, user_id: int) -> Profile | None:
        self.calls.append(user_id)
        return self._profile


def _make_profile(*, email: str | None = None, bark_key: str | None = None) -> Profile:
    """Build a lightweight Profile instance without persisting to DB."""
    profile = Profile(id=1, user_id=1)
    profile.email = email
    profile.bark_device_key = bark_key
    return profile


@pytest.mark.asyncio
async def test_context_from_config_uses_config_fields_when_present():
    """Config fields take priority — port should NOT be called."""
    port = FakeProfilePort(
        _make_profile(email="fallback@example.com", bark_key="fallback-key")
    )

    ctx = await context_from_config(
        user_id=1,
        config={"email": "user@example.com", "bark_device_key": "user-key"},
        profile_port=port,
    )

    assert ctx.email == "user@example.com"
    assert ctx.bark_device_key == "user-key"
    assert port.calls == []  # port never consulted


@pytest.mark.asyncio
async def test_context_from_config_falls_back_to_port_for_missing_email():
    """Missing email triggers port lookup."""
    profile = _make_profile(email="profile@example.com", bark_key="profile-key")
    port = FakeProfilePort(profile)

    ctx = await context_from_config(
        user_id=42,
        config={"bark_device_key": "user-key"},  # email missing
        profile_port=port,
    )

    assert ctx.email == "profile@example.com"
    assert ctx.bark_device_key == "user-key"  # from config, not profile
    assert port.calls == [42]


@pytest.mark.asyncio
async def test_context_from_config_falls_back_to_port_for_missing_bark_key():
    """Missing bark_device_key triggers port lookup."""
    profile = _make_profile(email="profile@example.com", bark_key="profile-key")
    port = FakeProfilePort(profile)

    ctx = await context_from_config(
        user_id=7,
        config={"email": "user@example.com"},  # bark_key missing
        profile_port=port,
    )

    assert ctx.email == "user@example.com"  # from config
    assert ctx.bark_device_key == "profile-key"  # from port
    assert port.calls == [7]


@pytest.mark.asyncio
async def test_context_from_config_port_returns_none():
    """Port returns None → fields stay None, no exception."""
    port = FakeProfilePort(None)

    ctx = await context_from_config(
        user_id=99,
        config={},  # everything missing
        profile_port=port,
    )

    assert ctx.email is None
    assert ctx.bark_device_key is None
    assert ctx.feishu_webhook_url is None
    assert port.calls == [99]


@pytest.mark.asyncio
async def test_context_from_config_feishu_url_no_fallback():
    """feishu_webhook_url has no DB fallback — only from config."""
    profile = _make_profile(email="e@example.com", bark_key="bark")
    port = FakeProfilePort(profile)

    ctx = await context_from_config(
        user_id=1,
        config={"feishu_webhook_url": "https://hook.example.com/xyz"},
        profile_port=port,
    )

    assert ctx.feishu_webhook_url == "https://hook.example.com/xyz"
    # email and bark_key missing → port called once
    assert port.calls == [1]
    assert ctx.email == "e@example.com"
    assert ctx.bark_device_key == "bark"


def test_fake_port_satisfies_protocol():
    """FakeProfilePort should be recognized as a ProfilePort."""
    assert isinstance(FakeProfilePort(None), ProfilePort)
