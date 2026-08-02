"""structlog 单一来源 —— JSON 结构化日志。

设计（规约见 ``docs/rules/logging.md``）：
- 全仓日志统一走 ``structlog``，``from app.core.logger import logger``。
- structlog 经 ``wrap_for_formatter`` 把事件交回 stdlib ``logging``，
  由 ``ProcessorFormatter`` 统一渲染：业务日志与 uvicorn/taskiq/sqlalchemy 等
  foreign 记录走**同一条**处理器链、同一套 JSON 长相。
- 输出目标：uvicorn.error / uvicorn.access 走 **stdout**（生命周期与请求轨迹
  在终端直接可见）；其余日志（app / taskiq / sqlalchemy）**只落盘**到
  app_info.log / app_error.log，不再向 stderr 输出。uvicorn.access 同时透传
  到 root，使每条请求仍按 trace_id 进 app_info.log。
- trace_id 由 ``_add_trace_id`` 处理器从 contextvar 注入，FastAPI middleware
  与 taskiq TraceMiddleware 负责设置/复位（见 ``logging_context.py``）。
- DB 持久化：专用 ``_DBHandler`` 终端处理器 ``_db_enqueue`` 做 fire-and-forget
  入队，纯 level 门控（WARNING+）。
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import logging.handlers
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

import structlog

from app.core.config import get_settings
from app.core.logging_context import trace_id_ctx

# -----------------------------------------------------------------------------
# 阈值与路径
# -----------------------------------------------------------------------------
_LOG_LEVEL = os.getenv("LOG_LEVEL") or get_settings().LOG_LEVEL
_ERROR_NO = logging.ERROR

# structlog 输出的 level 名是小写字符串（"warning"/"error"/"critical"）；
# 不在 shared_processors 里加 level_number（保持输出 schema 四键精简），
# 故 DB 门控按名字集合判定。
_LEVELS_FOR_DB = frozenset({"warning", "error", "critical"})

MAX_LOG_SIZE = 1_000_000  # 1 MB
BACKUP_COUNT = 5

# 写入 DB extra 时排除的键：渲染/路由元数据、输出字段、内部标记。
_DB_EXCLUDE = frozenset(
    {
        "_record",
        "_from_structlog",
    }
)

# -----------------------------------------------------------------------------
# 处理器：trace_id / timestamper
# -----------------------------------------------------------------------------
_timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)


def _add_trace_id(logger, method_name, event_dict):
    """从 contextvar 注入 trace_id，缺省显示 "-"。"""
    event_dict.setdefault("trace_id", trace_id_ctx.get())
    return event_dict


def _event_to_message(logger, method_name, event_dict):
    """把 structlog 的 ``event`` 键重命名为 ``message``。

    ``shared_processors`` 在 structlog.configure 与每个 handler 的
    ``foreign_pre_chain`` 里各跑一遍；重命名只在首遍生效（后续 ``message`` 已存在、
    ``event`` 已不存在），天然幂等。
    """
    if "event" in event_dict and "message" not in event_dict:
        event_dict["message"] = event_dict.pop("event")
    return event_dict


# 两端共享的前置链：业务记录与 foreign 记录都跑一遍，产出统一 event_dict。
# 注意：此处**不得**放 ``filter_by_level`` 或任何副作用处理器——
#   1. ``filter_by_level`` 在 ``foreign_pre_chain`` 里收到 ``logger=None`` 会抛
#      AttributeError（foreign 记录没有 structlog wrapper logger）；foreign 记录
#      的级别过滤交给 stdlib handler 的 ``setLevel``。
# 顺序依赖：PositionalArgumentsFormatter 必须先于 _event_to_message —— 它要对
# event_dict["event"] 做 `%s` 占位符格式化（stdlib logging 风格），而
# _event_to_message 会把 event 重命名为 message（此时 "event" 键已不存在，
# 格式化会 KeyError）。
shared_processors = [
    _add_trace_id,
    structlog.stdlib.PositionalArgumentsFormatter(),
    _event_to_message,
    structlog.stdlib.add_log_level,
    _timestamper,
    structlog.processors.StackInfoRenderer(),
    structlog.processors.format_exc_info,
    structlog.processors.UnicodeDecoder(),
]

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        *shared_processors,
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)


# -----------------------------------------------------------------------------
# 路由：用 logging.Filter 决定某条记录是否进该 handler
# -----------------------------------------------------------------------------
class _InfoFilter(logging.Filter):
    """app_info.log：INFO <= 级别 < ERROR。"""

    def filter(self, record: logging.LogRecord) -> bool:
        return record.levelno < _ERROR_NO


class _ErrorFilter(logging.Filter):
    """app_error.log：级别 >= ERROR。"""

    def filter(self, record: logging.LogRecord) -> bool:
        return record.levelno >= _ERROR_NO


# -----------------------------------------------------------------------------
# 渲染器：终端 Console（dev），文件统一 JSON
# -----------------------------------------------------------------------------
_stderr_renderer = (
    structlog.dev.ConsoleRenderer()
    if sys.stderr.isatty()
    else structlog.processors.JSONRenderer()
)
_json_renderer = structlog.processors.JSONRenderer()

_foreign_pre_chain = shared_processors


def _make_formatter(terminal) -> structlog.stdlib.ProcessorFormatter:
    return structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=_foreign_pre_chain,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            terminal,
        ],
    )


# -----------------------------------------------------------------------------
# 日志目录
# -----------------------------------------------------------------------------
base = Path(__file__).resolve().parent.parent
base = base.parent

_log_path_env: str | None = os.getenv("LOG_PATH")
if _log_path_env:
    log_path = Path(_log_path_env)
else:
    log_dir = Path(os.getenv("LOG_DIR", base / "logs"))
    log_path = log_dir / "app.log"

log_path.parent.mkdir(parents=True, exist_ok=True)

info_log_path = log_path.with_stem(f"{log_path.stem}_info")
error_log_path = log_path.with_stem(f"{log_path.stem}_error")


# -----------------------------------------------------------------------------
# DB sink：纯 level 门控，asyncio.Queue 异步入库
# -----------------------------------------------------------------------------
# 解耦同步 logger 与异步 DB：_db_enqueue 纯 level 门控后入队，
# 后台 _log_worker 单 consumer 取消息、async session 直写 Log 表。
# maxsize 防内存无限增长；同步入队在 queue 满时丢弃这条（sys.stderr 留痕）。
_log_queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=1000)


async def _log_worker() -> None:
    """单 consumer：从 _log_queue 取 payload，async session 直写 Log 表。"""
    from app.api.des.db import get_async_session
    from app.models.log import Log

    while True:
        payload = await _log_queue.get()
        try:
            async with get_async_session() as session:
                session.add(
                    Log(
                        timestamp=payload["timestamp"],
                        level=payload["level"],
                        message=payload["message"],
                        extra=payload.get("extra") or {},
                    )
                )
                # get_async_session 退出时统一 commit
        except Exception as e:
            sys.stderr.write(f"[log-sink] {e}\n")
        finally:
            _log_queue.task_done()


def _coerce_timestamp(value: object) -> datetime:
    """TimeStamper(fmt="iso") 产出 ISO 字符串，但 Log.timestamp 是
    DateTime(timezone=True)：asyncpg 拒绝 str，故统一在此归一为 datetime。
    """
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        # structlog ISO 形如 "2026-08-02T06:32:15.942963Z"，Python <3.11 不认 'Z'
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return datetime.now(UTC)


def _db_enqueue(logger, method_name, event_dict):
    """纯 level 门控：level ≥ DB_LOG_LEVEL 才入队，其余丢弃。

    仅作为 ``_DBHandler`` 的终端处理器运行 → 每条记录只入队一次。
    处理器在同步上下文里被调用，用 ``call_soon_threadsafe`` 把入队操作
    调度到运行中的 event loop；无 loop 或 queue 满时丢弃并留痕 stderr。
    """
    if event_dict.get("level") not in _LEVELS_FOR_DB:
        return ""

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # 当前线程无运行中的 event loop（worker 启动早期、同步代码路径），
        # 无法调度入队；丢弃这条以避免抛错污染日志流。
        return ""

    try:
        # extra 保留 trace_id 与业务 bind 字段（Log 模型无 trace_id 列，
        # 故 trace_id 进 JSON extra，可供按链路查询）；level / message /
        # timestamp 已是顶层列，不进 extra 避免重复。
        exclude = _DB_EXCLUDE | {"level", "message", "timestamp"}
        extra = {k: v for k, v in event_dict.items() if k not in exclude}
        payload = {
            "timestamp": _coerce_timestamp(event_dict.get("timestamp")),
            "level": event_dict.get("level", "info"),
            "message": event_dict.get("message", ""),
            "extra": extra,
        }
        loop.call_soon_threadsafe(_log_queue.put_nowait, payload)
    except asyncio.QueueFull:
        sys.stderr.write("[log-sink] queue full, record dropped\n")
    except Exception as e:
        sys.stderr.write(f"[log-sink] {e}\n")
    return ""


class _DBHandler(logging.Handler):
    """触发 ProcessorFormatter 链（含 ``_db_enqueue``）但不写任何输出。"""

    def emit(self, record: logging.LogRecord) -> None:
        # self.format 跑 foreign_pre_chain + 终端处理器，副作用即入队；
        # 返回值是空串，忽略。sink 自身异常绝不冒泡打断业务日志流。
        with contextlib.suppress(Exception):
            self.format(record)


def start_log_worker() -> asyncio.Task:
    """启动后台 _log_worker；应在 app startup 调用。"""
    return asyncio.create_task(_log_worker())


async def drain_log_queue() -> None:
    """等待 queue 排空；应在 app shutdown 调用（在 cancel worker 前）。"""
    await _log_queue.join()


# -----------------------------------------------------------------------------
# 组装 root logger
# -----------------------------------------------------------------------------
_root = logging.getLogger()
# 清掉 basicConfig / 框架自带的 handler，全仓由下面三个 file/db handler 接管
for _h in list(_root.handlers):
    _root.removeHandler(_h)
_root.setLevel(logging.INFO)

# 终端不再输出业务 / 框架日志（仅 uvicorn.* 单独挂 stdout handler，详见下方）。
# 保留 _stderr_renderer 供 uvicorn.* stdout handler 复用同一渲染链。

if get_settings().SAVE_LOGS:
    # app_info.log：INFO <= 级别 < ERROR 的主轨迹
    _info_handler = logging.handlers.RotatingFileHandler(
        info_log_path,
        maxBytes=MAX_LOG_SIZE,
        backupCount=BACKUP_COUNT,
        encoding="utf-8",
    )
    _info_handler.setLevel(logging.INFO)
    _info_handler.addFilter(_InfoFilter())
    _info_handler.setFormatter(_make_formatter(_json_renderer))
    _root.addHandler(_info_handler)

    # app_error.log：级别 >= ERROR
    _error_handler = logging.handlers.RotatingFileHandler(
        error_log_path,
        maxBytes=MAX_LOG_SIZE,
        backupCount=BACKUP_COUNT,
        encoding="utf-8",
    )
    _error_handler.setLevel(logging.ERROR)
    _error_handler.addFilter(_ErrorFilter())
    _error_handler.setFormatter(_make_formatter(_json_renderer))
    _root.addHandler(_error_handler)

    # DB 持久化 handler：终端处理器 _db_enqueue 入队，纯 level 门控
    _db_handler = _DBHandler()
    _db_handler.setLevel(logging.INFO)  # 低门栏放行，_db_enqueue 内部按 level 判定
    _db_handler.setFormatter(_make_formatter(_db_enqueue))
    _root.addHandler(_db_handler)


# -----------------------------------------------------------------------------
# foreign logger 路由：uvicorn.* 走 stdout，其它透传 root 落盘
# -----------------------------------------------------------------------------
def _install_foreign_propagation() -> None:
    """拆分 foreign logger 的输出目标。

    - ``uvicorn.error``：清自带 handler、挂 stdout handler、``propagate=False``
      （生命周期事件只到 stdout，避免和业务 ERROR 混进 app_error.log）。
    - ``uvicorn.access``：清自带 handler、挂 stdout handler、``propagate=True``
      （请求轨迹同时进 app_info.log，按 trace_id 与业务日志串联）。
    - ``taskiq`` / ``sqlalchemy.engine``：清自带 handler、``propagate=True``，
      由 root 的 file handlers 统一落盘。

    structlog 的 ``ProcessorFormatter`` + ``foreign_pre_chain`` 在每个目标 logger
    上都把 stdlib 记录渲染成同款 JSON，无需 InterceptHandler 拦截转发。
    """
    stdout_formatter = _make_formatter(_stderr_renderer)
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setLevel(_LOG_LEVEL)
    stdout_handler.setFormatter(stdout_formatter)

    # 父 logger "uvicorn" 也清掉自带 handler，挂同一个 stdout handler——某些 uvicorn
    # 版本会直接在 "uvicorn" 上发启动/关闭事件；propagate=False 避免子 logger 重复。
    uvicorn_root = logging.getLogger("uvicorn")
    uvicorn_root.handlers = [stdout_handler]
    uvicorn_root.propagate = False

    _uvicorn_error = logging.getLogger("uvicorn.error")
    _uvicorn_error.handlers = [stdout_handler]
    _uvicorn_error.propagate = False
    _uvicorn_error.setLevel(logging.INFO)

    _uvicorn_access = logging.getLogger("uvicorn.access")
    _uvicorn_access.handlers = [stdout_handler]
    _uvicorn_access.propagate = True  # 同时进 root → app_info.log
    _uvicorn_access.setLevel(logging.INFO)

    for name in ("taskiq", "sqlalchemy.engine"):
        std_logger = logging.getLogger(name)
        std_logger.handlers = []
        std_logger.propagate = True


_install_foreign_propagation()

logger = structlog.get_logger()

__all__ = ["drain_log_queue", "logger", "start_log_worker"]
