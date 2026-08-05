"""API tests for ``POST /v2/translate`` — 匿名可用、标准信封 ``{message, data}``。

不触碰真实 LLM：把 ``state.translate_svc.translate`` 换成 stub（实例属性覆盖
类方法，端点以 ``(text, target_lang)`` 两参调用即可）。

限流：端点挂 ``@limiter.limit("20/minute")``，key 按 IP（``client_key``）。
测试请求走真实 Redis（本地 6379），单测内 2 次请求远低于阈值，验证
限流中间件不阻塞正常路径即可。
"""

from __future__ import annotations

import pytest

from app.services.translate import TranslateResult

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_translate_endpoint_anonymous(api_app, api_client, monkeypatch):
    async def _fake_translate(text, target_lang):
        assert target_lang == "中文"
        return TranslateResult(text="你好，世界")

    api_app.state.services.translate_svc.translate = _fake_translate

    resp = await api_client.post(
        "/v2/translate",
        json={"text": "hello world", "targetLanguage": "中文"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] == "success"
    assert body["data"] == {"text": "你好，世界"}


async def test_translate_endpoint_requires_text(api_app, api_client):
    resp = await api_client.post(
        "/v2/translate",
        json={"text": "", "targetLanguage": "中文"},
    )
    assert resp.status_code == 422
