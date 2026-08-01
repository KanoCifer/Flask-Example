"""Taskiq middleware：为每次任务执行注入独立的 trace_id。

worker 端 ``pre_execute`` hook 在任务体 ``await`` 前、同一协程链里被调用
（见 taskiq ``Receiver.run_task``），因此此处的 ``set_trace_id`` 会传播进
任务执行体；任务结束 ``post_execute`` 复位，避免泄漏到后续任务。规约见
``docs/rules/logging.md`` §6。
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any

from taskiq.abc.middleware import TaskiqMiddleware

from app.core.logger import logger
from app.core.logging_context import reset_trace_id, set_trace_id

if TYPE_CHECKING:
    from taskiq.message import TaskiqMessage
    from taskiq.result import TaskiqResult


class TraceMiddleware(TaskiqMiddleware):
    """每次任务执行前生成新 trace_id，结束后复位。"""

    def __init__(self) -> None:
        super().__init__()
        # 持有 token 供 post_execute 复位；同一 broker 串行按任务串行执行，
        # 以 task_id 为键避免多个任务并发时 token 互相覆盖。
        self._tokens: dict[str, Any] = {}

    async def pre_execute(
        self, message: TaskiqMessage
    ) -> TaskiqMessage:
        self._tokens[message.task_id] = set_trace_id()
        # 投递延迟：handler 侧 .kiq() 时把 enqueued_at（wall-clock unix 时间戳）
        # 放进消息标签，此处距任务执行最近，打印"投递→收到"时延（跨进程可比）。
        enqueued_at = message.labels.get("enqueued_at")
        if enqueued_at is not None:
            logger.bind(
                task_id=message.task_id,
                task_name=message.task_name,
                delivery_ms=round((time.time() - float(enqueued_at)) * 1000, 1),
            ).info("taskiq: task received by worker")
        return message

    async def post_execute(
        self,
        message: TaskiqMessage,
        result: TaskiqResult[Any],
    ) -> None:
        token = self._tokens.pop(message.task_id, None)
        if token is not None:
            reset_trace_id(token)

    async def on_error(
        self,
        message: TaskiqMessage,
        result: TaskiqResult[Any],
        exception: BaseException,
    ) -> None:
        token = self._tokens.pop(message.task_id, None)
        if token is not None:
            reset_trace_id(token)


__all__ = ["TraceMiddleware"]
