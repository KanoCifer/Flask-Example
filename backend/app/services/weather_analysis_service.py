from __future__ import annotations

from app.core.agent import AiAgent
from app.core.logger import logger
from app.schemas.aiagent import WeatherAnalysisInput


class WeatherAnalysisService:
    """AI 流式天气分析。"""

    def __init__(self, ai_agent: AiAgent) -> None:
        self._ai_agent: AiAgent = ai_agent

    async def analyze_weather(
        self, weather_data: WeatherAnalysisInput, model_id: str | None = None
    ):
        """根据天气数据进行分析并生成报告"""
        from app.services.fishing.fishing_index import parse_tide_info

        async def _on_index_calculated(data: dict, ai_score: int) -> None:
            """训练回调：AI 分析完成后保存反馈并触发自动训练"""
            # FishingService uses Mongo-backed repo (no session needed);
            # use a lightweight module-level-style instance for this callback.
            from app.repositories import FishingRepo
            from app.services.fishing.fishing_service import FishingService

            svc = FishingService(repo=FishingRepo())
            await svc.save_ai_analysis_feedback(
                data, ai_score, parse_tide_info
            )

        try:
            async for chunk in self._ai_agent.analyze_weather_stream(
                weather_data=weather_data,
                model_id=model_id,
                on_index_calculated=_on_index_calculated,
            ):
                # chunk 是 agent 层归一化后的 {type, content} dict,直接透传
                yield {
                    "type": chunk["type"],
                    "content": chunk["content"],
                    "is_end": False,
                }
            yield {"type": "content", "content": "", "is_end": True}
        except ValueError as exc:
            logger.error(f"天气分析参数错误: {exc!r}")
            yield {
                "type": "content",
                "content": "[ERROR] 天气分析参数错误",
                "is_end": True,
            }
        except RuntimeError as exc:
            logger.error(f"天气分析运行时错误: {exc!r}")
            yield {
                "type": "content",
                "content": "[ERROR] 天气分析服务暂不可用",
                "is_end": True,
            }
        except Exception as exc:
            logger.error(f"天气分析失败: {exc!r}")
            yield {
                "type": "content",
                "content": "[ERROR] 天气分析失败",
                "is_end": True,
            }
