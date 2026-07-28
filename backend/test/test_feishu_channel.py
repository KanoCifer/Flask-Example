"""Unit tests for FeishuChannel — interactive card 2.0, no external calls."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx2
import pytest

from app.plugins.notification import Message, NotificationContext
from app.plugins.notification.channels.feishu import (
    _DEFAULT_CARD_COLOR,
    FeishuChannel,
    _build_feishu_card,
)

# ── helpers ──────────────────────────────────────────────────────


def _make_response(status_code=200, json_data=None):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx2.HTTPStatusError(
            "err", request=MagicMock(), response=resp
        )
    else:
        resp.raise_for_status.return_value = None
    return resp


def _mock_client(response):
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    client.post.return_value = response
    return client


# ── _build_feishu_card ───────────────────────────────────────────


class TestBuildFeishuCard:
    """Verify the card 2.0 JSON structure matches the Feishu schema."""

    def test_schema_version(self):
        card = _build_feishu_card("title", "body", "green")
        assert card["schema"] == "2.0"

    def test_header_title(self):
        card = _build_feishu_card("My Title", "body", "blue")
        header = card["header"]
        assert header["title"] == {"tag": "plain_text", "content": "My Title"}
        assert header["template"] == "blue"

    def test_header_color_passed_through(self):
        card = _build_feishu_card("t", "b", "red")
        assert card["header"]["template"] == "red"

    def test_body_markdown_element(self):
        card = _build_feishu_card("t", "**bold** text", "green")
        elements = card["body"]["elements"]
        assert len(elements) == 1
        assert elements[0] == {"tag": "markdown", "content": "**bold** text"}

    def test_body_layout(self):
        card = _build_feishu_card("t", "b", "green")
        body = card["body"]
        assert body["direction"] == "vertical"
        assert body["padding"] == "12px"

    def test_config_update_multi(self):
        card = _build_feishu_card("t", "b", "green")
        assert card["config"]["update_multi"] is True

    def test_full_structure_matches_go(self):
        """Spot-check the full dict shape mirrors Go buildFeishuCard."""
        card = _build_feishu_card("title", "body", "green")
        assert card == {
            "schema": "2.0",
            "config": {"update_multi": True},
            "header": {
                "title": {"tag": "plain_text", "content": "title"},
                "template": "green",
            },
            "body": {
                "direction": "vertical",
                "padding": "12px",
                "elements": [{"tag": "markdown", "content": "body"}],
            },
        }


# ── FeishuChannel.send ───────────────────────────────────────────


class TestFeishuChannelSend:
    """Test FeishuChannel.send() with mocked httpx2."""

    @pytest.fixture
    def channel(self):
        return FeishuChannel()

    @pytest.fixture
    def ctx(self):
        return NotificationContext(
            feishu_webhook_url="https://hook.example.com"
        )

    @pytest.mark.asyncio
    async def test_send_success_default_color(self, channel, ctx):
        """Successful send uses default green color when Message.color is None."""
        resp = _make_response(200, {"code": 0, "msg": "ok"})
        mock = _mock_client(resp)

        msg = Message(title="Test", body="Hello")
        with patch("httpx2.AsyncClient", return_value=mock):
            result = await channel.send(msg, ctx)

        assert result is True
        # Verify payload structure
        call_args = mock.post.call_args
        payload = call_args.kwargs["json"]
        assert payload["msg_type"] == "interactive"
        assert payload["card"]["header"]["template"] == _DEFAULT_CARD_COLOR
        assert payload["card"]["header"]["title"]["content"] == "Test"
        assert payload["card"]["body"]["elements"][0]["content"] == "Hello"

    @pytest.mark.asyncio
    async def test_send_success_custom_color(self, channel, ctx):
        """Message.color controls the card header template."""
        resp = _make_response(200, {"code": 0})
        mock = _mock_client(resp)

        msg = Message(title="Alert", body="Error occurred", color="red")
        with patch("httpx2.AsyncClient", return_value=mock):
            result = await channel.send(msg, ctx)

        assert result is True
        payload = mock.post.call_args.kwargs["json"]
        assert payload["card"]["header"]["template"] == "red"

    @pytest.mark.asyncio
    async def test_send_missing_webhook_returns_false(self, channel, monkeypatch):
        """When no webhook URL is available, send returns False without HTTP call."""
        ctx = NotificationContext()  # no feishu_webhook_url
        msg = Message(title="t", body="b")

        # Ensure global settings has no webhook URL either
        fake_settings = MagicMock()
        fake_settings.FEISHU_WEBHOOK_URL = ""
        monkeypatch.setattr(
            "app.plugins.notification.channels.feishu.get_settings",
            lambda: fake_settings,
        )

        with patch("httpx2.AsyncClient") as mock_client:
            result = await channel.send(msg, ctx)

        assert result is False
        mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_send_http_error_returns_false(self, channel, ctx):
        """Non-2xx response returns False."""
        resp = _make_response(500, {"code": 500})
        mock = _mock_client(resp)

        msg = Message(title="t", body="b")
        with patch("httpx2.AsyncClient", return_value=mock):
            result = await channel.send(msg, ctx)

        assert result is False

    @pytest.mark.asyncio
    async def test_send_api_error_code_returns_false(self, channel, ctx):
        """Feishu API returns non-zero code → send returns False."""
        resp = _make_response(200, {"code": 9499, "msg": "rate limited"})
        mock = _mock_client(resp)

        msg = Message(title="t", body="b")
        with patch("httpx2.AsyncClient", return_value=mock):
            result = await channel.send(msg, ctx)

        assert result is False

    @pytest.mark.asyncio
    async def test_send_exception_returns_false(self, channel, ctx):
        """Network exception during send returns False, not raised."""
        mock = AsyncMock()
        mock.__aenter__.side_effect = httpx2.ConnectError("boom")

        msg = Message(title="t", body="b")
        with patch("httpx2.AsyncClient", return_value=mock):
            result = await channel.send(msg, ctx)

        assert result is False

    @pytest.mark.asyncio
    async def test_send_uses_statuscode_field(self, channel, ctx):
        """Feishu sometimes returns StatusCode instead of code."""
        resp = _make_response(200, {"StatusCode": 0, "Msg": "success"})
        mock = _mock_client(resp)

        msg = Message(title="t", body="b")
        with patch("httpx2.AsyncClient", return_value=mock):
            result = await channel.send(msg, ctx)

        assert result is True

    @pytest.mark.asyncio
    async def test_send_url_from_context(self, channel):
        """Webhook URL is taken from ctx.feishu_webhook_url."""
        ctx = NotificationContext(feishu_webhook_url="https://custom.hook/abc")
        resp = _make_response(200, {"code": 0})
        mock = _mock_client(resp)

        msg = Message(title="t", body="b")
        with patch("httpx2.AsyncClient", return_value=mock):
            await channel.send(msg, ctx)

        call_args = mock.post.call_args
        assert call_args.kwargs["url"] == "https://custom.hook/abc"


# ── FeishuChannel.name ───────────────────────────────────────────


def test_channel_name():
    assert FeishuChannel().name == "feishu"
