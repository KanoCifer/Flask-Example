"""Behavior tests for app/core/logger.py — queue gate + trace_id + routing.

These tests mirror the production calling context (an async request handler
with a running event loop), so the queue-gate and trace_id tests are async.
Under asyncio_mode=auto a synchronous test has no running loop, which would
make _db_enqueue early-return before enqueueing.

The info/error/db handlers only attach when ``SAVE_LOGS=True``; to exercise
the DB enqueue path deterministically we attach a ``_DBHandler`` to root for
the duration of the queue + trace_id tests regardless of that flag.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from datetime import UTC, datetime

import pytest
import structlog

from app.core.logger import (
    _db_enqueue,
    _DBHandler,
    _ErrorFilter,
    _InfoFilter,
    _json_renderer,
    _log_queue,
    _make_formatter,
)
from app.core.logging_context import reset_trace_id, set_trace_id

# ── helpers ──────────────────────────────────────────────────────


def _flush_queue() -> list[dict]:
    """Drain _log_queue non-blocking, calling task_done on each item."""
    items: list[dict] = []
    while not _log_queue.empty():
        try:
            items.append(_log_queue.get_nowait())
            _log_queue.task_done()
        except asyncio.QueueEmpty:
            break
    return items


@pytest.fixture(autouse=True)
def drain_log_queue():
    """每个测试前后清空 queue，保证 gate 断言的隔离。"""
    _flush_queue()
    yield
    _flush_queue()


@pytest.fixture
def db_handler():
    """把 _DBHandler 临时挂到 root，保证 DB 入库路径在 SAVE_LOGS=False 时也能跑到。"""
    handler = _DBHandler()
    handler.setLevel(logging.INFO)
    handler.setFormatter(_make_formatter(_db_enqueue))
    root = logging.getLogger()
    root.addHandler(handler)
    yield handler
    root.removeHandler(handler)


# ── tests ────────────────────────────────────────────────────────


class TestQueueGate:
    """DB 入库纯 level 门控：WARNING+ 入队，INFO 不入队。"""

    async def test_warning_enqueues(self, db_handler):
        structlog.get_logger().warning("warn msg")
        await asyncio.sleep(0)  # let call_soon_threadsafe callback fire
        items = _flush_queue()
        assert len(items) == 1
        assert items[0]["level"] == "warning"
        assert items[0]["message"] == "warn msg"

    async def test_error_enqueues(self, db_handler):
        structlog.get_logger().error("err msg")
        await asyncio.sleep(0)
        items = _flush_queue()
        assert len(items) == 1
        assert items[0]["level"] == "error"

    async def test_info_not_enqueued(self, db_handler):
        structlog.get_logger().info("info msg")
        await asyncio.sleep(0)
        assert _log_queue.empty()


class TestTraceId:
    """trace_id 由 processor 自动注入；DB 落库在 extra 里。"""

    async def test_trace_id_auto_injected(self, db_handler):
        token = set_trace_id()
        try:
            structlog.get_logger().warning("trace here")
            await asyncio.sleep(0)
            items = _flush_queue()
        finally:
            reset_trace_id(token)
        # trace_id 进 extra（Log 模型无顶层 trace_id 列），且不等于默认 "-"
        assert items[0]["extra"]["trace_id"] != "-"

    async def test_trace_id_defaults_to_dash(self, db_handler):
        """未在 context 中 set 时，trace_id 为 "-"。"""
        structlog.get_logger().warning("no ctx")
        await asyncio.sleep(0)
        items = _flush_queue()
        assert items[0]["extra"]["trace_id"] == "-"


class TestOutputSchema:
    """输出 JSON 仅含四键：trace_id / level / message / timestamp。"""

    def test_json_has_only_four_keys(self):
        """对一条合成 WARNING 记录渲染 JSONRenderer，验证仅四键。

        直接走 ``_make_formatter(JSONRenderer)`` 而不依赖 capfd ——
        全局 stderr handler 在 import 时已捕获真实 fd，capfd 看不到。
        """
        record = logging.LogRecord(
            "test", logging.WARNING, "f", 1, "schema check", (), None
        )
        rendered = _make_formatter(_json_renderer).format(record)
        parsed = json.loads(rendered)
        assert set(parsed.keys()) == {"trace_id", "level", "message", "timestamp"}


class TestRouting:
    """双文件路由：_InfoFilter / _ErrorFilter 工作正确；无 access handler。"""

    def test_info_filter_admits_info_and_warning(self):
        info_rec = logging.LogRecord("x", 20, "f", 1, "m", (), None)
        err_rec = logging.LogRecord("x", 40, "f", 1, "m", (), None)
        f = _InfoFilter()
        assert f.filter(info_rec) is True
        assert f.filter(err_rec) is False

    def test_error_filter_admits_only_error_plus(self):
        warn_rec = logging.LogRecord("x", 30, "f", 1, "m", (), None)
        err_rec = logging.LogRecord("x", 40, "f", 1, "m", (), None)
        f = _ErrorFilter()
        assert f.filter(warn_rec) is False
        assert f.filter(err_rec) is True

    def test_no_access_handler_present(self):
        root = logging.getLogger()
        for h in root.handlers:
            for filt in getattr(h, "filters", []):
                assert filt.__class__.__name__ != "_AccessFilter"


class TestTimestampCoercion:
    """TimeStamper(fmt="iso") 产出 ISO 字符串，Log.timestamp 是 DateTime(timezone=True)
    → asyncpg 拒绝 str，故入队前需归一为 datetime（防回归）。"""

    def _direct(self, value):
        from app.core.logger import _coerce_timestamp

        return _coerce_timestamp(value)

    def test_iso_z_suffix_becomes_aware_datetime(self):
        ts = self._direct("2026-08-02T06:32:15.942963Z")
        assert isinstance(ts, datetime)
        assert ts.tzinfo is not None
        assert ts.utcoffset() == datetime.now(UTC).utcoffset()

    def test_naive_datetime_gains_utc_tz(self):
        naive = datetime(2026, 8, 2, 6, 32, 15)
        out = self._direct(naive)
        assert out.tzinfo is UTC

    def test_aware_datetime_passes_through(self):
        aware = datetime(2026, 8, 2, 6, 32, 15, tzinfo=UTC)
        out = self._direct(aware)
        assert out is aware

    def test_missing_value_falls_back_to_now(self):
        out = self._direct(None)
        assert isinstance(out, datetime)
        assert out.tzinfo is UTC

    async def test_enqueued_payload_has_datetime_timestamp(self, db_handler):
        structlog.get_logger().warning("regression")
        await asyncio.sleep(0)
        items = _flush_queue()
        assert len(items) == 1
        ts = items[0]["timestamp"]
        assert isinstance(ts, datetime), f"expected datetime, got {type(ts).__name__}"
        assert ts.tzinfo is not None


class TestUvicornRouting:
    """uvicorn.error / uvicorn.access 走 stdout；其它 foreign logger 透传到 root。

    约束：
    - uvicorn.error: 单 stdout handler，propagate=False（不进文件）
    - uvicorn.access: 单 stdout handler，propagate=True（同时进 app_info.log）
    - taskiq / sqlalchemy.engine: 无自身 handler，propagate=True
    - root 在 SAVE_LOGS=False 时无任何 StreamHandler（终端不再打业务日志）
    """

    def _handler_streams(self, logger_):
        return {h.stream for h in logger_.handlers if isinstance(h, logging.StreamHandler)}

    def test_root_has_no_stderr_handler(self):
        """终端不再输出业务 / 框架日志——只剩 uvicorn.* 走 stdout。"""
        streams = self._handler_streams(logging.getLogger())
        assert sys.stderr not in streams
        assert sys.stdout not in streams

    def test_uvicorn_error_routes_to_stdout_only(self):
        err = logging.getLogger("uvicorn.error")
        streams = self._handler_streams(err)
        assert sys.stdout in streams
        assert sys.stderr not in streams
        assert err.propagate is False  # 不进 app_error.log

    def test_uvicorn_access_routes_to_stdout_and_propagates(self):
        access = logging.getLogger("uvicorn.access")
        streams = self._handler_streams(access)
        assert sys.stdout in streams
        assert sys.stderr not in streams
        assert access.propagate is True  # 同时进 app_info.log

    def test_taskiq_and_sqlalchemy_propagate_only(self):
        for name in ("taskiq", "sqlalchemy.engine"):
            lg = logging.getLogger(name)
            assert lg.handlers == []
            assert lg.propagate is True
