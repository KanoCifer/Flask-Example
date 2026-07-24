from fastapi import HTTPException, Request
from limits import parse as parse_limit
from limits.storage import storage_from_string
from limits.strategies import FixedWindowRateLimiter
from slowapi import Limiter

from app.core.config import settings


def client_key(request: Request) -> str:
    """限流 key：取 `X-Forwarded-For` 末段（最右侧的非空值），缺则退化到
    `request.client.host`（直连场景）。

    约定：反代使用 `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
    时，nginx 会把客户端原始头保留在前、再把 `$remote_addr` 追加在末尾。因此
    末段**永远是反代看到的真实来源 IP**，客户端伪造的首段被忽略。
    直连或无 XFF 时退回到 `request.client.host`。
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        last = xff.rsplit(",", 1)[-1].strip()
        if last:
            return last
    return get_remote_address(request)


def get_remote_address(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# 全局唯一的 limiter 实例
limiter = Limiter(key_func=client_key, storage_uri=settings.REDIS_URL)

# 按 mode 分别限流的独立 limiter（summary/chat 共用 ``/thread/stream`` 端点，
# slowapi 装饰器只能静态配 limit，无法按 request body 的 mode 动态切换，所以
# 这里用底层 limits 库手动实现：summary 5/min、chat 20/min，key 带 mode 前缀隔离）。
_mode_limiter = FixedWindowRateLimiter(storage_from_string(settings.REDIS_URL))


def check_mode_rate_limit(mode: str, client_ip: str) -> None:
    """按 mode 分别限流。

    summary 模式 5/min，chat 模式 20/min。超出时抛 HTTPException(429)，由
    FastAPI 异常处理器转 JSON 响应。key 形如 ``thread_stream:summary:<ip>``，
    两种 mode 各自独立计数。
    """
    limit = parse_limit("5/minute" if mode == "summary" else "20/minute")
    key = f"thread_stream:{mode}:{client_ip}"
    if not _mode_limiter.hit(limit, key):
        raise HTTPException(
            status_code=429, detail="请求过于频繁，请稍后再试"
        )
