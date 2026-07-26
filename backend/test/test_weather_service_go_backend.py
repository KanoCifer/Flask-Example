"""Tests for WeatherService.get_full_weather_data_from_go — Go backend client."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import httpx2

from app.core.exceptions import WeatherDomainError
from app.services.weather_service import WeatherService


@pytest.fixture
def svc():
    return WeatherService()


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


def _go_weather_payload():
    """模拟 Go /v3/weather/full 的 data 字段结构。"""
    return {
        "current": {"code": "200", "now": {"temp": "25", "humidity": "60"}},
        "hourly": {"code": "200", "hourly": []},
        "daily": {"code": "200", "daily": [{"fxDate": "2026-07-26"}]},
        "tide": {
            "code": "200",
            "tideTable": [
                {"fxTime": "2026-07-26T03:00+08:00", "height": "2.0", "type": "H"}
            ],
        },
        "indices": {
            "code": "200",
            "daily": [{"date": "2026-07-26", "level": "2", "name": "钓鱼指数"}],
        },
        "locationName": "观澜山水田园旅游文化园",
        "poiId": "101280606",
    }


# ── tests ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_full_weather_data_from_go_success(svc):
    """正常路径：Go 端返回 200，返回与 get_full_weather_data 同构的 dict。"""
    payload = {"data": _go_weather_payload(), "message": "success"}
    resp = _make_response(200, payload)

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.get.return_value = resp

    with patch("httpx2.AsyncClient", return_value=mock_client):
        result = await svc.get_full_weather_data_from_go("114.23,22.75")

    assert result["current"]["now"]["temp"] == "25"
    assert result["indices"]["daily"][0]["level"] == "2"
    assert result["tide"]["tideTable"][0]["type"] == "H"
    assert result["locationName"] == "观澜山水田园旅游文化园"
    assert result["poiId"] == "101280606"

    # 验证请求参数
    mock_client.get.assert_called_once()
    call_kwargs = mock_client.get.call_args
    assert call_kwargs.kwargs["params"] == {"location": "114.23,22.75"}


@pytest.mark.asyncio
async def test_get_full_weather_data_from_go_http_error(svc):
    """Go 端返回 500 → 抛出 WeatherDomainError。"""
    resp = _make_response(500, {"message": "internal error"})

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.get.return_value = resp

    with patch("httpx2.AsyncClient", return_value=mock_client):
        with pytest.raises(WeatherDomainError):
            await svc.get_full_weather_data_from_go("114.23,22.75")


@pytest.mark.asyncio
async def test_get_full_weather_data_from_go_connection_error(svc):
    """Go 端不可达（网络错误）→ 抛出 WeatherDomainError(503)。"""
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.get.side_effect = httpx2.ConnectError("connection refused")

    with patch("httpx2.AsyncClient", return_value=mock_client):
        with pytest.raises(WeatherDomainError) as exc_info:
            await svc.get_full_weather_data_from_go("114.23,22.75")
    assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_get_full_weather_data_from_go_no_data_field(svc):
    """Go 端返回 200 但 data 字段为空 → 抛出 WeatherDomainError(502)。"""
    resp = _make_response(200, {"data": None, "message": "ok"})

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.get.return_value = resp

    with patch("httpx2.AsyncClient", return_value=mock_client):
        with pytest.raises(WeatherDomainError) as exc_info:
            await svc.get_full_weather_data_from_go("114.23,22.75")
    assert exc_info.value.status_code == 502
