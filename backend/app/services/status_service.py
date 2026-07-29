from __future__ import annotations

import asyncio
import gc
import platform
import sys
import time

import psutil
from cpuinfo import get_cpu_info
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logger import logger
from app.core.startup import SERVER_START_TIME
from app.repositories.public_repo import PublicRepo


class StatusService:
    """API 状态检查与系统健康指标。"""

    def __init__(self, repo: PublicRepo) -> None:
        self.repo: PublicRepo = repo

    async def get_status_detail(self, session: AsyncSession) -> dict:
        """Collect version, service, and system health metrics."""

        # Database health check
        db_ok = True
        try:
            await asyncio.wait_for(
                session.execute(text("SELECT 1")),
                timeout=3.0,
            )
        except Exception:
            db_ok = False

        # --- Version Info ---
        version_info = {
            "repo_url": "https://github.com/KanoCifer/kuroome-blog",
            "current_version": get_settings().API_VERSION,
        }

        # --- Service Info ---
        mem = psutil.virtual_memory()
        process = psutil.Process()
        heap_memory = process.memory_info().rss

        service_info = {
            "runtime": f"{sys.platform}/{platform.machine()}",
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "coroutines": len(asyncio.all_tasks()),
            "gc_count": gc.get_count(),
            "start_time": round(SERVER_START_TIME, 0),
            "heap_memory_bytes": heap_memory,
            "total_memory_bytes": mem.total,
            "db_ok": db_ok,
            "api_ok": True,
        }

        # --- System Info ---
        # getloadavg() 是 Unix 专有，Windows 下不存在
        try:
            load_avg = [round(x, 2) for x in psutil.getloadavg()]
        except AttributeError:
            load_avg = [0.0, 0.0, 0.0]

        # py-cpuinfo 提供比 platform.processor() 更准确的 CPU 型号与逻辑核数
        try:
            cpu_info = get_cpu_info()
            cpu_model = cpu_info.get("brand_raw") or platform.processor() or "Unknown"
            cpu_count_logical = cpu_info.get("count") or psutil.cpu_count(logical=True)
        except Exception:
            cpu_model = platform.processor() or "Unknown"
            cpu_count_logical = psutil.cpu_count(logical=True)

        system_info = {
            "system_time": time.strftime(
                "%Y/%m/%d %H:%M:%S", time.localtime()
            ),
            "system_timezone": "GMT+8",
            "os_name": f"{platform.system()} {platform.release()}",
            "os_version": platform.version(),
            "kernel_version": platform.release(),
            "cpu_model": cpu_model,
            "cpu_count_physical": psutil.cpu_count(logical=False),
            "cpu_count_logical": cpu_count_logical,
            "load_average": {
                "1m": load_avg[0],
                "5m": load_avg[1],
                "15m": load_avg[2],
            },
            "cpu_percent": psutil.cpu_percent(interval=None),
            "memory_usage_percent": round(mem.percent, 1),
            "memory_used_bytes": mem.used,
            "memory_total_bytes": mem.total,
        }

        return {
            "version": version_info,
            "service": service_info,
            "system": system_info,
        }
