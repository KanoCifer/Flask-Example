"""
钓鱼服务编排器
组合 FishingIndex（纯计算）+ FishingRepo（数据访问）+ FishingModelService（模型）
"""

from __future__ import annotations

from collections.abc import Callable

from app.core.logger import logger
from app.repositories.fishing_repo import FishingRepo
from app.services.fishing.fishing_expert import FishingExpertScorer
from app.services.fishing.fishing_index import (
    FishingRecord,
    TideInfo,
    record_to_dict,
)
from app.services.fishing.fishing_model_service import FishingModelService


class FishingService:
    """钓鱼服务编排器——仅负责 repo I/O 和模型训练调度。

    所有依赖通过构造函数注入；组合根 :func:`new_app_state` 负责组装。
    """

    def __init__(
        self,
        repo: FishingRepo,
        expert: FishingExpertScorer | None = None,
        model_svc: FishingModelService | None = None,
    ) -> None:
        self.repo = repo
        self.expert = expert or FishingExpertScorer()
        self.model_svc = model_svc or FishingModelService()

    def calculate_fishing_index(
        self, record: FishingRecord
    ) -> tuple[int, int, float, dict[str, float]]:
        """
        计算钓鱼指数（专家评分 + 模型残差）

        Returns:
            (最终指数, 专家评分, 残差, 特征评分详情)
        """
        record_dict = record_to_dict(record)

        logger.debug(
            f"[钓鱼指数] 输入记录: wind_speed={record.wind_speed} km/h, "
            f"temp={record.temperature}°C, pressure={record.pressure}hPa"
        )

        expert_score = self.expert.calculate(**record_dict)
        feature_breakdown = self.expert.get_feature_scores(**record_dict)
        residual = self.model_svc.predict_residual(record_dict)

        final_score = max(0, min(100, expert_score + residual))

        return (
            int(final_score),
            int(expert_score),
            round(residual, 1),
            feature_breakdown,
        )

    async def auto_train_if_needed(self, source: str = "all") -> dict | None:
        """检查记录数并自动训练模型（记录数 > 3 时触发）"""
        try:
            if source == "all":
                records = await self.repo.get_all_records_for_training()
            else:
                records = await self.repo.get_records_for_training_by_source(
                    source
                )

            record_count = len(records)
            logger.info(
                f"[钓鱼模型] 当前有 {record_count} 条 {source} 记录，开始检查是否需要训练"
            )

            if record_count <= 3:
                logger.info(f"[钓鱼模型] 记录数 {record_count} <= 3，跳过训练")
                return None

            record_dicts = []
            expert_scores = []
            actual_scores = []

            for record in records:
                record_dicts.append(
                    {
                        "temperature": record.temperature,
                        "humidity": record.humidity,
                        "pressure": record.pressure,
                        "wind_speed": record.wind_speed,
                        "precipitation": record.precipitation,
                        "indices": record.indices,
                        "tide_type": "涨潮"
                        if record.tide_type == "H"
                        else "退潮",
                        "hours_to_next_tide": record.hours_to_next_tide,
                        "tide_range": record.tide_range,
                    }
                )
                expert_scores.append(record.expert_score)
                actual_scores.append(record.feedback_score)

            logger.info(
                f"[钓鱼模型] 开始训练，使用 {len(record_dicts)} 条记录"
            )
            result = self.model_svc.train(
                record_dicts, expert_scores, actual_scores
            )
            logger.info(f"[钓鱼模型] 训练完成: {result}")
            return result

        except Exception as e:
            logger.error(f"[钓鱼模型] 自动训练失败: {e}", exc_info=True)
            return None

    async def save_feedback(self, doc_data: dict) -> str:
        """保存钓鱼反馈记录到 MongoDB"""
        try:
            record_id = await self.repo.save_fishing_record(doc_data)
            logger.info(f"[钓鱼服务] 反馈记录已保存: {record_id}")
            return str(record_id)
        except Exception as e:
            logger.error(f"[钓鱼服务] 保存反馈记录失败: {e}", exc_info=True)
            return "save_failed"

    async def save_ai_analysis_feedback(
        self,
        weather_data: dict,
        ai_score: int,
        parse_tide_info_fn: Callable[[dict], TideInfo],
    ) -> str:
        """
        保存 AI 分析产生的反馈记录并触发自动训练

        训练逻辑原属 WeatherAnalyzer，已提取到 services 层，消除 core→services 层级反转。
        """
        now = weather_data.get("liveWeather") or {}
        tide = weather_data.get("tideData") or {}
        fishing_index = weather_data.get("fishingIndex") or {}

        expert_score = (
            fishing_index.get("expert_score") if fishing_index else None
        )

        temperature = float(now.get("temp") or 20.0)
        humidity = float(now.get("humidity") or 50.0)
        pressure = float(now.get("pressure") or 1000.0)
        wind_speed = float(now.get("windSpeed") or 0.0)
        precipitation = float(now.get("precip") or 0.0)

        indices_raw = weather_data.get("weatherIndices")
        level = 2
        if (
            indices_raw
            and isinstance(indices_raw, list)
            and len(indices_raw) > 0
        ):
            level = int(indices_raw[0].get("level", 2))

        tide_info = parse_tide_info_fn(tide)
        tide_type_str = "涨潮" if tide_info.tide_type == "涨潮" else "退潮"

        location_name = (
            weather_data.get("locationName")
            or weather_data.get("tideSpotName")
            or "未知"
        )
        now_iso = now.get("obsTime") if now else None

        doc_data = {
            "location_id": location_name,
            "location_name": location_name,
            "fishing_time": now_iso,
            "temperature": temperature,
            "humidity": humidity,
            "pressure": pressure,
            "wind_speed": wind_speed,
            "precipitation": precipitation,
            "indices": level,
            "tide_level": tide_info.tide_level,
            "tide_type": tide_type_str,
            "tide_range": tide_info.tide_range,
            "hours_to_next_tide": tide_info.hours_to_next_tide,
            "expert_score": expert_score or 0.0,
            "feedback_score": ai_score,
            "feedback": "好" if ai_score >= 70 else "一般",
            "source": "ai",
        }

        record_id = await self.save_feedback(doc_data)
        logger.info(f"[天气分析] AI 评分 {ai_score} 已保存，开始自动训练")
        await self.auto_train_if_needed(source="all")
        return record_id

    async def get_stats(self) -> dict:
        """获取钓鱼统计数据（总记录数 + 最近记录时间）"""
        total = await self.repo.count_records()
        latest = await self.repo.get_latest_record()
        return {
            "total_records": total,
            "latest_record_time": (
                latest.fishing_time.isoformat() if latest else None
            ),
        }
