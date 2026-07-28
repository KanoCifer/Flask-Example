import inspect
import json
from functools import wraps
from typing import Any

from cachetools.keys import hashkey
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from redis.asyncio import Redis as AsyncRedis

from app.core import logger
from app.core.config import get_settings


class AsyncCache:
    """基于 Redis 的异步缓存，支持装饰器和手动 set/get。"""

    def __init__(self, redis_client: AsyncRedis) -> None:
        self.redis: AsyncRedis = redis_client
        self._cache_prefix = "cache:"

    def __call__(
        self,
        func: Any | None = None,
        ttl: int = 60,
        exclude: list[str] | None = None,
    ) -> Any:
        """支持 @cache 和 @cache(ttl=xx) 两种用法。

        缓存层只认 Pydantic/dict
        """
        excluded = set(exclude or [])

        def decorate(target: Any) -> Any:
            sig = inspect.signature(target)

            @wraps(target)
            async def wrapper(*args, **kwargs):
                bound = sig.bind(*args, **kwargs)
                bound.apply_defaults()
                params = {
                    k: v
                    for k, v in bound.arguments.items()
                    if k not in excluded
                }
                key = self._make_key(target.__name__, **params)

                cached = await self.get(key)
                if cached is not None:
                    logger.info(f"Cache hit: {key}")
                    return JSONResponse(
                        content=cached,
                        headers={"X-Cache": "HIT"},
                    )

                result = await target(*args, **kwargs)
                await self.set(key, result, ttl)
                if isinstance(result, BaseModel):
                    return result
                return JSONResponse(
                    content=result,
                    headers={"X-Cache": "MISS"},
                )

            return wrapper

        if func is not None:
            return decorate(func)
        return decorate

    def _make_key(self, func_name: str, **params) -> str:
        """生成唯一的缓存键

        显式带 func_name 前缀,这样 invalidate() 可以用 SCAN 按函数名通配删除。
        """
        return f"{func_name}|{hashkey(**params)}"

    async def _delete_by_pattern(self, pattern: str) -> int:
        """Scan + 分批 delete 所有匹配 pattern 的 key。返回删除条数。

        失败时降级为日志并返回 0。
        """
        try:
            keys: list[str] = [
                k async for k in self.redis.scan_iter(match=pattern, count=200)
            ]
        except Exception:
            logger.exception(f"Cache scan failed for {pattern!r}")
            return 0
        if not keys:
            return 0
        try:
            for i in range(0, len(keys), 1000):
                await self.redis.delete(*keys[i : i + 1000])
        except Exception:
            logger.exception(f"Cache delete failed for {pattern!r}")
            return 0
        return len(keys)

    async def invalidate(self, *func_names: str) -> int:
        """按视图函数名批量删除其生成的所有缓存 key。返回删除条数。

        失败时降级为日志,不影响调用方主流程。
        """
        if not func_names:
            return 0
        deleted = 0
        for name in func_names:
            deleted += await self._delete_by_pattern(
                self._cache_prefix + name + "|*"
            )
        if deleted:
            logger.info(f"Invalidated {deleted} cache keys for {func_names}")
        return deleted

    async def set(self, key, value: Any, ttl: int = 60) -> None:
        redis_key = self._cache_prefix + str(key)
        if isinstance(value, BaseModel):
            payload: str = value.model_dump_json()
        else:
            payload = json.dumps(value, default=str)
        await self.redis.set(redis_key, payload, ex=ttl)

    async def get(self, key) -> Any:
        redis_key = self._cache_prefix + str(key)
        value = await self.redis.get(redis_key)
        if value is None:
            return None
        return json.loads(value)

    async def clear(self) -> None:
        """清空所有缓存 key。"""
        deleted = await self._delete_by_pattern(self._cache_prefix + "*")
        if deleted:
            logger.info(f"Cleared {deleted} cache keys")
        else:
            logger.info("No cache keys to clear")

    async def aclose(self) -> None:
        await self.redis.aclose()


def make_redis_client() -> AsyncRedis:
    """Factory: 从当前 settings 构造一个 redis client。"""
    return AsyncRedis.from_url(
        get_settings().REDIS_URL,
        decode_responses=True,
        max_connections=get_settings().REDIS_MAX_CONNECTIONS,
    )


# 默认实例：装饰器 @redis_cache 和 ad-hoc 失效（invalidate/clear）都通过它访问。
# 进程启动时 eager 构造，lifespan 关闭时调用 close_cache_redis。
redis_cache = AsyncCache(redis_client=make_redis_client())


async def close_cache_redis():
    """关闭默认实例的底层 client。FastAPI lifespan 调用。"""
    await redis_cache.aclose()
