from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

import httpx2
import orjson

if TYPE_CHECKING:
    from redis.asyncio import Redis as AsyncRedis

from app.core import logger
from app.core.config import get_settings
from app.core.exceptions import WeatherDomainError
from app.utils.qweather_jwt import generate_qweather_jwt

_QWEATHER_BASE_URL = get_settings().QWEATHER_BASE_URL.rstrip("/")
_GO_BACKEND_URL = get_settings().GO_BACKEND_URL.rstrip("/")


class _QWeatherClient:
    """Private QWeather HTTP client with auth + caching."""

    def __init__(self, redis: AsyncRedis) -> None:
        self._redis = redis

    async def get(
        self,
        path: str,
        *,
        params: dict,
        cache_key: str,
        ttl: int,
    ) -> dict:
        """Authenticated, cached GET. Raises WeatherDomainError on failure."""
        cached = await self._redis.get(cache_key)
        if cached:
            return orjson.loads(cached)

        jwt = await self._get_jwt()
        url = _QWEATHER_BASE_URL + path
        headers = {"Authorization": f"Bearer {jwt}"}

        try:
            async with httpx2.AsyncClient() as client:
                response = await client.get(
                    url, headers=headers, params=params
                )
                response.raise_for_status()
                data = response.json()
        except httpx2.HTTPStatusError as exc:
            response = exc.response
            raise WeatherDomainError(
                f"QWeather API error: {response.status_code} - {response.text}",
                response.status_code,
            ) from exc
        except httpx2.HTTPError as exc:
            raise WeatherDomainError(
                f"Failed to fetch QWeather data: {exc!s}", 503
            ) from exc

        await self._redis.set(cache_key, orjson.dumps(data), ex=ttl)
        return data

    def resolve_location(
        self,
        location: str | None,
        location_id: str | None,
    ) -> tuple[str, dict]:
        """Validate location input, return (value, params_dict).

        Raises WeatherDomainError if both/neither provided.
        """
        if location_id:
            return location_id, {"location": location_id}
        if location:
            return location, {"location": location}
        raise WeatherDomainError("必须提供位置信息", 400)

    async def _get_jwt(self) -> str:
        """Cached JWT generation."""
        cache_key = "qweather:jwt"
        cached_jwt = await self._redis.get(cache_key)
        if cached_jwt:
            if isinstance(cached_jwt, bytes):
                return cached_jwt.decode()
            return str(cached_jwt)

        encoded_jwt: str = generate_qweather_jwt()
        await self._redis.set(cache_key, encoded_jwt, ex=24 * 3600)
        return encoded_jwt


class WeatherService:
    async def get_qweather_tide(
        self, redis: AsyncRedis, harbor: str, date: str
    ) -> tuple[dict, bool]:
        cache_key: str = f"qweather:tide:{harbor}:{date}"
        cached = await redis.get(cache_key)
        if cached:
            return orjson.loads(cached), True

        client = _QWeatherClient(redis)
        data = await client.get(
            "/v7/ocean/tide",
            params={"location": harbor, "date": date},
            cache_key=cache_key,
            ttl=12 * 3600,
        )
        return data, False

    async def get_qweather_location(
        self, location: str, type_: str, redis: AsyncRedis
    ) -> dict:
        client = _QWeatherClient(redis)
        cache_key = f"qweather:location:{location}:{type_}"
        return await client.get(
            "/geo/v2/poi/lookup",
            params={"location": location, "type": type_},
            cache_key=cache_key,
            ttl=24 * 3600,
        )

    async def get_weather_forecast(
        self,
        days: int,
        redis: AsyncRedis,
        location: str | None = None,
        location_id: str | None = None,
    ) -> dict:
        client = _QWeatherClient(redis)
        loc_value, params = client.resolve_location(location, location_id)
        return await client.get(
            f"/v7/weather/{days}d",
            params=params,
            cache_key=f"qweather:forecast:{loc_value}:{days}d",
            ttl=3600,
        )

    async def get_current_weather(
        self,
        redis: AsyncRedis,
        location: str | None = None,
        location_id: str | None = None,
    ) -> dict:
        client = _QWeatherClient(redis)
        loc_value, params = client.resolve_location(location, location_id)
        return await client.get(
            "/v7/weather/now",
            params=params,
            cache_key=f"qweather:current:{loc_value}",
            ttl=600,
        )

    async def get_poi_lookup(self, location: str, redis: AsyncRedis) -> dict:
        client = _QWeatherClient(redis)
        return await client.get(
            "/geo/v2/poi/lookup",
            params={"location": location, "type": "scenic"},
            cache_key=f"qweather:poi:{location}:scenic",
            ttl=24 * 3600,
        )

    async def get_hourly_weather(
        self,
        hours: int,
        redis: AsyncRedis,
        location_id: str | None = None,
        location: str | None = None,
    ) -> dict:
        client = _QWeatherClient(redis)
        loc_value, params = client.resolve_location(location, location_id)
        return await client.get(
            f"/v7/weather/{hours}h",
            params=params,
            cache_key=f"qweather:hourly:{loc_value}",
            ttl=1800,
        )

    async def get_indices(
        self,
        redis: AsyncRedis,
        location: str | None = None,
        location_id: str | None = None,
    ) -> dict:
        client = _QWeatherClient(redis)
        loc_value, params = client.resolve_location(location, location_id)
        params["type"] = "4"
        return await client.get(
            "/v7/indices/1d",
            params=params,
            cache_key=f"qweather:indices:{loc_value}",
            ttl=12 * 3600,
        )

    async def get_nearby_tsta(self, location: str, redis: AsyncRedis) -> dict:
        """获取指定经纬度附近的潮汐站点（TSTA）信息。

        Returns
            dict: 包含站点名称和ID的字典，例如 {"name": "站点名称", "id": "站点ID"}。
        """
        client = _QWeatherClient(redis)
        data = await client.get(
            "/geo/v2/poi/lookup",
            params={"location": location, "type": "TSTA"},
            cache_key=f"qweather:tsta:{location}",
            ttl=24 * 3600,
        )
        poi = data.get("poi", [])[0] if data.get("poi") else {}
        return {"id": poi.get("id")}

    async def get_full_weather_data(
        self, location: str, redis: AsyncRedis
    ) -> dict:
        poi_data = await self.get_poi_lookup(location, redis)
        poi_name = (
            poi_data.get("poi", [])[0].get("name")
            if poi_data.get("poi")
            else None
        )
        poi_id = (
            poi_data.get("poi", [])[0].get("id")
            if poi_data.get("poi")
            else None
        )
        logger.info(
            f"POI lookup for location {location} returned: {poi_name} (ID: {poi_id})"
        )

        try:
            tsta_info = await self.get_nearby_tsta(location, redis)
            if tsta_info.get("id"):
                tsta_id = tsta_info["id"]
                logger.info(
                    f"Found nearby TSTA station for ID: {tsta_info['id']})"
                )
            else:
                logger.warning(
                    f"No nearby TSTA station found for location {location}"
                )
        except WeatherDomainError as exc:
            logger.error(
                f"Error fetching nearby TSTA station for location {location}: {exc!s}"
            )
            tsta_id = None

        if not poi_name and not poi_id:
            raise WeatherDomainError("无法获取位置的POI信息", 404)

        try:
            current_weather = await self.get_current_weather(
                location=location, redis=redis
            )

            hourly_weather = await self.get_hourly_weather(
                hours=24, redis=redis, location=location
            )
            daily_weather = await self.get_weather_forecast(
                location=location,
                days=3,
                redis=redis,
            )

            date_str = datetime.now(UTC).strftime("%Y%m%d")
            tide_data, _ = await self.get_qweather_tide(
                redis, harbor=tsta_id or "P2352", date=date_str
            )

            indices_data = await self.get_indices(redis, location=location)
        except WeatherDomainError as exc:
            logger.error(
                f"Error fetching weather data for location {location}: {exc!s}"
            )
            raise
        except Exception as exc:
            logger.error(
                f"Unexpected error fetching weather data for location {location}: {exc!s}",
                exc_info=True,
            )
            raise WeatherDomainError(
                "获取天气数据失败，请稍后再试", 503
            ) from exc

        logger.debug(
            f"Fetched full weather data for location: {location} (POI: {poi_name or poi_id})"
            f" - Current: {current_weather.get('now', {})}"
        )

        return {
            "current": current_weather,
            "hourly": hourly_weather,
            "daily": daily_weather,
            "tide": tide_data,
            "indices": indices_data,
            "locationName": poi_name or "",
            "poiId": poi_id or "",
        }

    async def get_full_weather_data_from_go(self, location: str) -> dict:
        """从 Go 后端 /v3/weather/full 获取聚合天气数据。

        Go 端已完成 POI/TSTA/current/hourly/daily/tide/indices 的并发请求与缓存，
        Python 钓鱼指数端点只需一次 HTTP 调用即可拿到全部所需数据。

        Returns:
            dict: 与 get_full_weather_data() 同构
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

        # 透传 Go 端原始结构，与 get_full_weather_data() 返回对齐。
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
