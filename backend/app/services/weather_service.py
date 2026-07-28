from __future__ import annotations

import httpx2

from app.core.config import get_settings
from app.core.exceptions import WeatherDomainError

_GO_BACKEND_URL = get_settings().GO_BACKEND_URL.rstrip("/")


class WeatherService:
    async def get_full_weather_data_from_go(self, location: str) -> dict:
        """从 Go 后端 /v3/weather/full 获取聚合天气数据。

        Go 端已完成 POI/TSTA/current/hourly/daily/tide/indices 的并发请求与缓存，
        Python 钓鱼指数端点只需一次 HTTP 调用即可拿到全部所需数据。

        Returns:
            dict: 与旧 QWeather 直连路径同构
                  (current/hourly/daily/tide/indices/locationName/poiId)。

        Raises:
            WeatherDomainError: Go 端不可达或返回错误。
        """
        url = f"{_GO_BACKEND_URL}/v3/weather/full"
        try:
            async with httpx2.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params={"location": location})
                response.raise_for_status()
                payload = response.json()
        except httpx2.HTTPStatusError as exc:
            raise WeatherDomainError(
                f"Go backend weather error: {exc.response.status_code}",
                exc.response.status_code,
            ) from exc
        except httpx2.HTTPError as exc:
            raise WeatherDomainError(
                f"Failed to reach Go backend: {exc!s}", 503
            ) from exc

        # Go 响应结构: {"data": {...}, "message": "..."}
        data = payload.get("data")
        if not data:
            raise WeatherDomainError(
                "Go backend returned no data", 502
            )

        # 透传 Go 端原始结构。
        return {
            "current": data.get("current", {}),
            "hourly": data.get("hourly", {}),
            "daily": data.get("daily", {}),
            "tide": data.get("tide", {}),
            "indices": data.get("indices", {}),
            "locationName": data.get("locationName", ""),
            "poiId": data.get("poiId", ""),
        }


weather_service = WeatherService()
