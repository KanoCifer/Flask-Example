from __future__ import annotations

from app.core.agent import AiAgent
from app.core.logger import logger
from app.schemas.aiagent import WeatherAnalysisInput
from app.services.fishing.fishing_service import FishingService


class WeatherAnalysisService:
    """AI 流式天气分析。

    依赖：
    - ``ai_agent``: Agno AI agent（含 LLM + Redis session store）。
    - ``fishing_svc``: 可选；天气分析完成后用于保存反馈记录 + 触发模型训练。
      由组合根 :func:`new_app_state` 注入，避免回调内联构造绕过 DI。
    """

    def __init__(
        self,
        ai_agent: AiAgent,
        fishing_svc: FishingService | None = None,
    ) -> None:
        self._ai_agent: AiAgent = ai_agent
        self._fishing_svc = fishing_svc

    async def analyze_weather(
        self, weather_data: WeatherAnalysisInput, model_id: str | None = None
    ):
        """根据天气数据进行分析并生成报告"""
        from app.services.fishing.fishing_index import parse_tide_info

        async def _on_index_calculated(data: dict, ai_score: int) -> None:
            """训练回调：AI 分析完成后保存反馈并触发自动训练。

            使用注入的 fishing_svc（来自 app_state），不再内联构造。
            """
            if self._fishing_svc is None:
                logger.warning(
                    "[天气分析] fishing_svc 未注入，跳过反馈保存"
                )
                return
            await self._fishing_svc.save_ai_analysis_feedback(
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
