from contextlib import asynccontextmanager

from redis.asyncio import Redis as AsyncRedis


class LockAcquireError(Exception):
    """Redis锁获取失败异常"""

    def __init__(self, message: str):
        super().__init__(message)


@asynccontextmanager
async def dedup_guard(redis: AsyncRedis, key: str, ttl: int):
    """基于时间窗口的去重守卫。

    设置一个带 TTL 的 key，整个 TTL 期间内后续调用会被拒绝。
    退出上下文时不会删除 key，由 Redis TTL 自动过期。

    适用于防止定时任务在短时间内被多次触发导致重复执行。

    :param:
        redis: Redis客户端实例
        key: 去重键名
        ttl: 去重窗口时间，单位秒
    :raises LockAcquireError: 当去重窗口内已有执行时抛出
    :yields: 首次调用成功后进入上下文
    """
    guard_key = f"dedup:{key}"
    acquired = bool(await redis.set(guard_key, "1", nx=True, ex=ttl))

    if not acquired:
        raise LockAcquireError(
            f"去重窗口内已有执行，跳过: {guard_key} (ttl={ttl}s)"
        )

    yield
