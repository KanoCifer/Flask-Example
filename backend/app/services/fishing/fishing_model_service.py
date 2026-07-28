"""
sklearn 残差学习模型服务
基于用户反馈学习专家公式的偏差，实现个性化校正
"""

from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler


class FishingModelService:
    """
    钓鱼指数残差学习模型

    架构:
    Final_score = Expert_score + learned_residual

    sklearn 学习的是残差 = 用户实际评分 - 专家评分
    """

    FEATURE_NAMES: list[str] = [  # noqa: RUF012
        "w1_temp",  # 温度
        "w2_humidity",  # 湿度
        "w3_pressure",  # 气压
        "w4_wind",  # 风速
        "w5_rain",  # 降水
        "w6_tide_rising",  # 是否涨潮
        "w7_hours_to_tide",  # 距离下一次潮汐的小时数
        "w8_tide_range",  # 潮差
        "w9_indices",  # 和风钓鱼指数参考
    ]

    def __init__(self, model_dir: Path | None = None) -> None:
        self.model_dir: Path = model_dir or Path("./models")
        self.model_dir.mkdir(parents=True, exist_ok=True)

        self.model: Ridge | None = None
        self.scaler: StandardScaler | None = None

        self._load_or_init()

    def _model_path(self) -> Path:
        return self.model_dir / "fishing_residual_model.joblib"

    def _scaler_path(self) -> Path:
        return self.model_dir / "fishing_scaler.joblib"

    def _load_or_init(self) -> None:
        """加载已有模型或初始化新模型"""
        if self._model_path().exists():
            self.load()
        else:
            self._init_model()

    def _init_model(self) -> None:
        """初始化新模型"""
        self.model = Ridge(alpha=1.0, fit_intercept=True)
        self.scaler = StandardScaler()
        # 用默认值拟合 scaler 和 model
        dummy_X = np.zeros((1, len(self.FEATURE_NAMES)))  # noqa: N806
        self.scaler.fit(dummy_X)
        # 用零残差拟合模型，使其可以正常预测
        self.model.fit(self.scaler.transform(dummy_X), [0.0])

    def _extract_features(self, record: dict) -> np.ndarray:
        """从钓鱼记录提取特征向量"""
        features = [
            record.get("temperature", 20.0),
            record.get("humidity", 50.0),
            record.get("pressure", 1000.0),
            record.get("wind_speed", 1.0) / 3.6,  # 转换为 m/s
            record.get("precipitation", 0.0),
            1.0 if record.get("tide_type") == "涨潮" else 0.5,
            record.get("hours_to_next_tide", 3.0),
            record.get("tide_range", 1.5),
            record.get("indices", 2),  # 默认为较适宜
        ]
        return np.array(features, dtype=np.float64)

    def train(
        self,
        records: list[dict],
        expert_scores: list[float],
        actual_scores: list[int],
    ) -> dict:
        """
        全量训练 Ridge 残差模型

        Args:
            records: 钓鱼记录列表
            expert_scores: 对应的专家评分列表
            actual_scores: 用户实际评分列表

        Returns:
            训练指标
        """
        if len(records) < 3:
            return {"error": "训练样本不足，需要至少3条记录"}

        # 提取特征
        X = np.array([self._extract_features(r) for r in records])  # noqa: N806

        # 计算残差
        residuals = np.array(actual_scores, dtype=np.float64) - np.array(
            expert_scores, dtype=np.float64
        )

        # 过滤异常残差（|残差| > 50）
        valid_mask = np.abs(residuals) <= 50
        X = X[valid_mask]  # noqa: N806
        residuals = residuals[valid_mask]

        if len(residuals) < 3:
            return {"error": "有效训练样本不足"}

        # 标准化
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)  # noqa: N806

        # 训练 Ridge
        self.model = Ridge(alpha=1.0, fit_intercept=True)
        self.model.fit(X_scaled, residuals)

        # 评估
        y_pred = self.model.predict(X_scaled)
        r2 = r2_score(residuals, y_pred)
        rmse = np.sqrt(mean_squared_error(residuals, y_pred))

        # 保存
        self.save()

        return {
            "n_samples": len(residuals),
            "r2": float(r2),
            "rmse": float(rmse),
        }

    def predict_residual(self, record: dict) -> float:
        """
        预测残差（个性化校正量）

        Args:
            record: 钓鱼记录

        Returns:
            预测的残差值 [-20, +20]
        """
        if self.model is None or self.scaler is None:
            return 0.0

        X = self._extract_features(record).reshape(1, -1)  # noqa: N806
        X_scaled = self.scaler.transform(X)  # noqa: N806
        residual = self.model.predict(X_scaled)[0]

        # 限制残差范围
        return np.clip(residual, -20, 20)

    def save(self) -> None:
        """保存模型到磁盘"""
        if self.model is None or self.scaler is None:
            return

        joblib.dump(self.model, self._model_path())
        joblib.dump(self.scaler, self._scaler_path())

    def load(self) -> None:
        """从磁盘加载模型"""
        if not self._model_path().exists():
            self._init_model()
            return

        self.model = joblib.load(self._model_path())
        self.scaler = joblib.load(self._scaler_path())

    def get_weights(self) -> dict[str, float]:
        """获取特征权重"""
        if self.model is None:
            return dict(
                zip(
                    self.FEATURE_NAMES,
                    [0.0] * len(self.FEATURE_NAMES),
                    strict=False,
                )
            )
        return dict(
            zip(self.FEATURE_NAMES, self.model.coef_.tolist(), strict=False)
        )


# 全局实例
fishing_model_service = FishingModelService()
