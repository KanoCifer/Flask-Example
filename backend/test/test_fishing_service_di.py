"""验证钓鱼模块 DI 解耦（架构评审 issue#4）。

- FishingService 不再依赖模块级单例，可注入 mock expert / model_svc。
- 测试无需触碰文件系统（FishingModelService 的 joblib I/O 被 mock 替换）。
"""

from __future__ import annotations

import pytest

from app.services.fishing.fishing_expert import FishingExpertScorer
from app.services.fishing.fishing_model_service import FishingModelService
from app.services.fishing.fishing_service import FishingService


class _FakeExpert:
    """Mock FishingExpertScorer — 固定返回预设评分。"""

    def __init__(self, score: float = 75.0) -> None:
        self._score = score
        self.calculate_calls: list[dict] = []

    def calculate(self, **kwargs) -> float:
        self.calculate_calls.append(kwargs)
        return self._score

    def get_feature_scores(self, **kwargs) -> dict[str, float]:
        return {"mock": 1.0}


class _FakeModelSvc:
    """Mock FishingModelService — 不碰磁盘，固定残差。"""

    def __init__(self, residual: float = 5.0) -> None:
        self._residual = residual
        self.predict_calls: list[dict] = []

    def predict_residual(self, record: dict) -> float:
        self.predict_calls.append(record)
        return self._residual


def test_fishing_service_accepts_injected_dependencies():
    """FishingService 接受注入的 expert + model_svc，不依赖全局单例。"""
    from app.repositories.fishing_repo import FishingRepo

    expert = _FakeExpert(score=80.0)
    model_svc = _FakeModelSvc(residual=3.0)

    svc = FishingService(
        repo=FishingRepo(),
        expert=expert,  # type: ignore[arg-type]
        model_svc=model_svc,  # type: ignore[arg-type]
    )

    assert svc.expert is expert
    assert svc.model_svc is model_svc


def test_fishing_service_defaults_without_globals():
    """不传 expert / model_svc 时，FishingService 自建实例（不依赖已删除的全局单例）。"""
    from app.repositories.fishing_repo import FishingRepo

    svc = FishingService(repo=FishingRepo())

    # 自建了真实实例（不是 None，也不是已删除的全局变量）
    assert isinstance(svc.expert, FishingExpertScorer)
    assert isinstance(svc.model_svc, FishingModelService)


def test_calculate_fishing_index_uses_injected_dependencies():
    """计算指数时使用注入的 mock，无需真实模型文件。"""
    from app.repositories.fishing_repo import FishingRepo
    from app.services.fishing.fishing_index import (
        FishingRecord,
        TideInfo,
    )

    expert = _FakeExpert(score=70.0)
    model_svc = _FakeModelSvc(residual=5.0)

    svc = FishingService(
        repo=FishingRepo(),
        expert=expert,  # type: ignore[arg-type]
        model_svc=model_svc,  # type: ignore[arg-type]
    )

    record = FishingRecord(
        temperature=25.0,
        humidity=60.0,
        pressure=1013.0,
        wind_speed=10.0,
        precipitation=0.0,
        tide_type="涨潮",
        hours_to_next_tide=2.0,
        tide_range=2.5,
        indices=1,
    )

    final_score, expert_score, residual, breakdown = (
        svc.calculate_fishing_index(record)
    )

    assert expert_score == 70
    assert residual == 5.0
    assert final_score == 75  # 70 + 5, clamped to [0, 100]
    assert len(expert.calculate_calls) == 1
    assert len(model_svc.predict_calls) == 1


def test_module_no_longer_has_singleton_instances():
    """模块不再导出单例实例 —— 导入时无文件 I/O 副作用。"""
    import importlib
    import sys

    # 强制重新导入，验证模块加载不触发 FishingModelService()
    for name in list(sys.modules):
        if "fishing_model_service" in name or "fishing_expert" in name:
            del sys.modules[name]

    importlib.import_module("app.services.fishing.fishing_model_service")
    import app.services.fishing.fishing_model_service as mod

    assert not hasattr(mod, "fishing_model_service"), (
        "模块仍导出 fishing_model_service 单例实例"
    )

    importlib.import_module("app.services.fishing.fishing_expert")
    import app.services.fishing.fishing_expert as expert_mod

    assert not hasattr(expert_mod, "fishing_expert"), (
        "模块仍导出 fishing_expert 单例实例"
    )
