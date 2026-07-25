from __future__ import annotations

import hashlib
import re
from collections.abc import AsyncIterator, Callable
from pickletools import read_stringnl_noescape
from typing import ClassVar, Literal

from agno.agent import RunEvent, RunOutputEvent
from agno.db.redis import RedisDb
from agno.run.agent import ReasoningContentDeltaEvent

from app.core.config import get_settings
from app.core.llm_factory import (
    create_agent,
    create_llm_model,
    create_redis_db,
)
from app.core.logger import logger
from app.schemas.aiagent import (
    DayForecastInput,
    FishingContextInput,
    LiveWeatherInput,
    TideDataInput,
    TideEventInput,
    TideHourlyInput,
    WeatherAnalysisInput,
    WeatherAnalysisInputSchema,
    WeatherAnalysisOutputSchema,
)

# ── 统一 AiAgent ───────────────────────────────────────────────────── #


class AiAgent:
    """统一的 LLM Agent，聚合文章总结、对话、天气分析三类能力。

    所有 model / agent / db 创建统一走 ``llm_factory``，不再直接 import agno。
    通过 ``AppState`` 注入，取代模块级全局单例。
    """

    # ── 模型映射 ───────────────────────────────────────────────────── #

    _SUMMARY_MODEL_MAP: ClassVar[dict[str, str]] = {
        "Ring 2.6": "Ring-2.6-1T",
        "Ling 2.6": "Ling-2.6-1T",
        "Ling 3.0 Flash": "Ling-3.0-flash",
    }

    _WEATHER_MODELS: ClassVar[dict[str, dict[str, str]]] = {
        "Ling-2.6-1T": {
            "id": "Ling-2.6-1T",
            "base_url": "https://api.ant-ling.com/v1",
        },
        "Ring-2.6-1T": {
            "id": "Ring-2.6-1T",
            "base_url": "https://api.ant-ling.com/v1",
        },
        "Ling-3.0-flash": {
            "id": "Ling-3.0-flash",
            "base_url": "https://api.ant-ling.com/v1",
        },
    }
    _WEATHER_DEFAULT_MODEL = "Ling-3.0-flash"

    _MAX_INPUT_CHARS = 128_000

    # ── System Prompts ─────────────────────────────────────────────── #

    _UNIFIED_SYSTEM_PROMPT = (
        "你是一名智能阅读助手，根据 mode 执行不同任务。\n\n"
        "[mode=summary]\n"
        "你是一名专业的中文内容分析师。你的任务是提炼文章的核心信息，"
        "让读者用最少时间获得最大价值。\n\n"
        "## 分析步骤\n"
        "1. 先识别文章类型（技术教程 / 观点论述 / 新闻报道 / 工具介绍 / 经验分享）\n"
        "2. 根据类型确定总结侧重：\n"
        "   - 技术教程：重点保留操作步骤、关键配置、踩坑点\n"
        "   - 观点论述：重点保留核心论点、论据、结论\n"
        "   - 新闻报道：重点保留事件、数据、影响\n"
        "   - 工具介绍：重点保留解决什么问题、核心特性、适用场景\n"
        "   - 经验分享：重点保留结论、方法论、可复用的经验\n"
        "3. 按优先级提炼要点：核心结论 > 关键数据/案例 > 技术细节 > 背景铺垫\n"
        "4. 输出总结\n\n"
        "## 输出格式\n"
        "- 用数字编号分点，每点一句话概括一个要点\n"
        "- 代码/命令/配置必须说明其作用，不可省略\n"
        "- 最后附一段「总评」：1-2 句话说明文章的整体价值或局限性\n"
        "- 长度控制在原文的 10-15%\n\n"
        "## 约束\n"
        "- 禁止编造原文没有的信息\n"
        "- 只输出总结本身，不要输出分析过程\n\n"
        "[mode=chat]\n"
        "你是一名中文知识助手，和用户一起深入探讨他刚读过的文章。\n\n"
        "## 回答原则\n"
        "- 优先从文章内容中找依据，引用原文关键句\n"
        "- 技术问题可以展开原理，结合文章上下文举例\n"
        "- 不确定的内容主动说明局限性\n\n"
        "## 搜索工具\n"
        "- 问题超出文章范围时，用 WebSearchTools 搜索补充，注明「以下来自搜索结果」\n"
        "- 搜索结果不足时，结合已有文章内容补全\n\n"
        "## 对话节奏\n"
        "- 简洁直接，不重复用户问题\n"
        "- 回答后可以在适当时机追问「你想深入了解哪个方面？」引导进一步讨论"
    )

    _WEATHER_PROMPT_TEMPLATE = """
        你是一名专业的垂钓气象与潮汐分析师，擅长综合天气和潮汐数据判断钓鱼条件。
        ## 分析维度
        依次评估以下因素对钓鱼的影响：
        - **温度**：鱼类活跃度随水温变化，15-25°C 通常最佳
        - **风速风向**：微风（3-15 km/h）有利于钓鱼；强风（>30 km/h）危险
        - **气压**：高气压稳定（>1013 hPa）适合钓鱼；气压骤降时鱼口差
        - **降水**：小雨可提升鱼口；暴雨/雷暴禁止出钓
        - **潮汐**：涨潮前后 1-2 小时（尤其高潮前）通常是最佳钓鱼窗口；
          大潮差（高低潮落差 >2m）水流湍急，鱼不易开口；
          平潮期（高/低潮后 30 分钟内）水流缓，适合底钓
        - **云量/光照**：阴天或多云通常优于正午烈日



        ## 输出Markdown格式（严格遵守）
        ## 钓鱼指数：XX / 100
        **出钓建议**：一句话概括（极佳 / 良好 / 一般 / 不宜 / 禁止）
        ### 逐项分析
        | 维度 | 当前状况 | 影响评估 |
        |------|----------|----------|
        | 温度 | ... | ... |
        | 风况 | ... | ... |
        | 气压 | ... | ... |
        | 降水 | ... | ... |
        | 潮汐 | ... | ... |
        ### 最佳出钓窗口
        根据潮汐表，今日推荐时段：HH:MM - HH:MM（说明原因）
        ### 建议
        - 出钓建议（时段/钓点/装备）
        - 注意事项或安全提示


        ## 评分规则
        - 先按专家权重计算基准分（归一化权重，总和=1）：
          {weights_line}
        - Expert_score = Σ(weight_i * feature_score_i) * 100，feature_score_i 范围 [0,1]，但 pressure 特征可达 [0,2]
        - 再给出 AI 自主修正分（-20~20），并说明修正依据（短时天气波动、天气现象、潮汐时序）
        - 最终钓鱼指数 = clip(专家基准分 + AI 自主修正分, 0, 100)
        - 90-100：极佳，强烈推荐
        - 70-89：良好，适合出钓
        - 50-69：一般，可以尝试但体验有限
        - 30-49：不宜，不建议出钓
        - 0-29：禁止，存在安全风险
        输出时必须显式给出：专家基准分、AI 自主修正分、最终钓鱼指数。
        若遇雷暴、台风或暴雨，评分直接置 0 并给出安全警告。
        回答简洁清晰，避免重复原始数据，聚焦分析与建议"""

    # ── 权重名称映射 ───────────────────────────────────────────────── #

    _WEIGHT_NAMES: ClassVar[dict[str, str]] = {
        "w1": "w1_temp",
        "w2": "w2_humidity",
        "w3": "w3_pressure",
        "w4": "w4_wind",
        "w5": "w5_rain",
        "w6": "w6_tide_rising",
        "w7": "w7_hours_to_tide",
        "w8": "w8_tide_range",
        "w9": "w9_indices",
    }

    _DEFAULT_WEIGHTS: ClassVar[dict[str, float]] = {
        "w1": 4 / 23,
        "w2": 2 / 23,
        "w3": 2 / 23,
        "w4": 2 / 23,
        "w5": 1 / 23,
        "w6": 4 / 23,
        "w7": 4 / 23,
        "w8": 2 / 23,
        "w9": 2 / 23,
    }

    def __init__(
        self,
        db: RedisDb | None = None,
        expert_weights: dict[str, float] | None = None,
    ) -> None:
        self._db = db or create_redis_db()
        weights = expert_weights or self._DEFAULT_WEIGHTS
        weights_line = ", ".join(
            f"{self._WEIGHT_NAMES.get(k, k)}={v:.4f}"
            for k, v in weights.items()
        )
        self._weather_system_prompt = self._WEATHER_PROMPT_TEMPLATE.format(
            weights_line=weights_line
        )

    # ── 公开接口 ───────────────────────────────────────────────────── #

    async def generate(
        self,
        mode: Literal["summary", "chat"],
        message: str,
        user_id: str,
        session_id: str,
        article_content: str | None = None,
        article_title: str | None = None,
        model_name: str | None = None,
    ) -> AsyncIterator[dict]:
        """统一的流式生成入口，通过 mode 切换总结 / 对话行为。

        mode=summary:
            对 article_content 生成结构化总结。
            session_id 由 article_hash 自动生成（无状态，相同文章复用会话）。
        mode=chat:
            基于 message 进行对话，首轮可附带 article_content grounding。
            使用调用方传入的 session_id（有状态，Agno 存历史）。
        """
        if not get_settings().API_KEY:
            logger.error("AI 服务未配置 API_KEY")
            raise RuntimeError("AI 服务未配置 API_KEY")

        model = self._resolve_summary_model(model_name)
        agent = create_agent(
            model=model,
            instructions=self._UNIFIED_SYSTEM_PROMPT,
            db=self._db,
        )

        if mode == "summary":
            normalized = self._normalize_content(article_content or "")
            if not normalized:
                raise ValueError("文章内容不能为空")
            user_prompt = self._build_summary_prompt(
                normalized, title=article_title
            )
            article_hash = self._hash_article(
                article_title, article_content or ""
            )
            session_id = self._article_session_id(
                user_id, article_hash, "summary"
            )
            async for event in agent.arun(
                user_prompt,
                stream=True,
                stream_events=True,
                user_id=user_id,
                session_id=session_id,
            ):
                if (
                    isinstance(event, ReasoningContentDeltaEvent)
                    and event.reasoning_content
                ):
                    yield {
                        "type": "reasoning",
                        "content": str(event.reasoning_content),
                    }
                elif isinstance(event, RunOutputEvent) and event.content:
                    yield {
                        "type": "content",
                        "content": str(event.content),
                    }

        elif mode == "chat":
            if not message.strip():
                raise ValueError("消息不能为空")
            context_prefix = ""
            if article_content:
                normalized = self._normalize_content(article_content)
                if normalized:
                    context_prefix = (
                        f"[文章上下文]\n标题: {article_title or '无标题'}\n"
                        f"内容摘要: {normalized[:2000]}...\n\n"
                    )
            full_message = f"{context_prefix}用户问题: {message}"
            async for event in agent.arun(
                full_message,
                session_id=session_id,
                stream_events=True,
                user_id=user_id,
                stream=True,
            ):
                if (
                    isinstance(event, ReasoningContentDeltaEvent)
                    and event.reasoning_content
                ):
                    yield {
                        "type": "reasoning",
                        "content": str(event.reasoning_content),
                    }
                elif isinstance(event, RunOutputEvent) and event.content:
                    yield {
                        "type": "content",
                        "content": str(event.content),
                    }

        else:
            raise ValueError(f"Unsupported mode: {mode}")

    async def analyze_weather_stream(
        self,
        weather_data: WeatherAnalysisInput,
        model_id: str | None = None,
        on_index_calculated: Callable | None = None,
    ):
        """流式分析天气数据。

        Args:
            on_index_calculated: 可选回调（sync 或 async），当提取到 AI 评分时调用。
                签名: (weather_data_dict: dict, ai_score: int) -> None
        """
        if not get_settings().API_KEY:
            logger.error("AI 服务未配置 API_KEY")
            raise RuntimeError("AI 服务未配置 API_KEY")

        try:
            input_schema = self._build_weather_input_schema(weather_data)
        except Exception:
            logger.exception("构建 input_schema 失败")
            raise

        model_key = model_id or self._WEATHER_DEFAULT_MODEL
        model_config = self._WEATHER_MODELS.get(
            model_key,
            {
                "id": "Ling-3.0-flash",
                "base_url": "https://api.ant-ling.com/v1",
            },
        )

        model = create_llm_model(
            model_id=model_config["id"],
        )

        agent = create_agent(
            model=model,
            instructions=self._weather_system_prompt,
            db=self._db,
        )

        try:
            event = agent.arun(
                input_schema, stream=True, stream_events=True, reasoning=True
            )
        except Exception:
            logger.exception("Agent 运行失败")
            raise

        buffer = ""
        async for chunk in event:
            if (
                isinstance(chunk, ReasoningContentDeltaEvent)
                and chunk.reasoning_content
            ):
                yield {
                    "type": "reasoning",
                    "content": str(chunk.reasoning_content),
                }
            elif isinstance(chunk, RunOutputEvent) and chunk.content:
                # 仅 content 通道的 delta 累加进 buffer，用于末尾的钓鱼指数正则提取
                text = str(chunk.content)
                buffer += text
                yield {
                    "type": "content",
                    "content": text,
                }

        # 提取最终钓鱼指数
        index = None
        buffer = buffer.strip()
        logger.debug(f"Final agent output: {buffer!r}")
        try:
            match = re.search(
                r"(?:\*\*)?最终钓鱼指数(?:\*\*)?[：:]\s*(\d+)", string=buffer
            )
            if match:
                index = int(match.group(1))
                logger.debug(f"Extracted fishing index: {index}")
            else:
                logger.warning("未能提取到钓鱼指数")
        except Exception:
            logger.exception("提取钓鱼指数失败")

        if index is not None and on_index_calculated is not None:
            try:
                result = on_index_calculated(weather_data.weather_data, index)
                import asyncio

                if asyncio.iscoroutine(result):
                    await result
            except Exception:
                logger.exception("on_index_calculated 回调失败")

    # ── 内部方法 ───────────────────────────────────────────────────── #

    def _resolve_summary_model(self, model_name: str | None = None):
        """根据友好名解析并创建总结/对话用 model 实例。"""
        if model_name and model_name not in self._SUMMARY_MODEL_MAP:
            raise ValueError(f"Unsupported model: {model_name}")
        model_id = (
            self._SUMMARY_MODEL_MAP[model_name]
            if model_name
            else "Ling-2.6-1T"
        )
        return create_llm_model(model_id=model_id)

    def _build_summary_prompt(
        self, normalized_content: str, title: str | None = None
    ) -> str:
        user_prompt = (
            "请总结下面文章内容，按要点进行总结，最后补一段总评。"
            "如果正文里出现代码/命令/配置，请至少用 1 条要点说明代码做了什么、为什么重要。\n\n"
        )
        if title:
            user_prompt += f"标题：{title}\n\n"
        user_prompt += f"正文：{normalized_content}"
        return user_prompt

    def _normalize_content(self, content: str) -> str:
        text = re.sub(r"<[^>]+>", " ", content)
        text = re.sub(r"\s+", " ", text).strip()
        return text[: self._MAX_INPUT_CHARS]

    @staticmethod
    def _hash_article(title: str | None, content: str) -> str:
        text = f"{title or ''}:{content[:5000]}"
        return hashlib.md5(text.encode()).hexdigest()[:16]

    @staticmethod
    def _article_session_id(
        user_id: str, article_hash: str, prefix: str = "summary"
    ) -> str:
        return f"{prefix}:{user_id}:{article_hash}"

    def _build_weather_input_schema(
        self, weather_data: WeatherAnalysisInput
    ) -> WeatherAnalysisInputSchema:
        """将 dict 格式的 weather_data 转换为类型化的 Pydantic 模型"""
        data = weather_data.weather_data

        fishing_ctx = data.get("fishingIndex")
        fishing_index = None
        if fishing_ctx:
            fishing_index = FishingContextInput(
                expert_score=fishing_ctx.get("expert_score"),
                feature_breakdown=fishing_ctx.get("feature_breakdown"),
            )

        live = data.get("liveWeather")
        live_weather = None
        if live:
            live_weather = LiveWeatherInput(
                temp=live.get("temp"),
                text=live.get("text"),
                wind360=live.get("wind360"),
                windSpeed=live.get("windSpeed"),
                windDir=live.get("windDir"),
                humidity=live.get("humidity"),
                pressure=live.get("pressure"),
                precip=live.get("precip"),
            )

        forecasts_raw = data.get("forecasts") or []
        forecasts = [
            DayForecastInput(
                date=f.get("date") or "",
                day_temp=f.get("daytemp") or "",
                day_weather=f.get("dayweather") or "",
                day_wind=f.get("daywind") or "",
                day_power=f.get("daypower") or "",
                night_temp=f.get("nighttemp") or "",
                night_weather=f.get("nightweather") or "",
            )
            for f in forecasts_raw[:3]
            if f and f.get("date")
        ]

        tide = data.get("tideData")
        tide_data = None
        if tide:
            tide_table = [
                TideEventInput(
                    type=t["type"],
                    fxTime=t.get("fxTime", ""),
                    height=float(t["height"]),
                )
                for t in tide.get("tideTable", [])
                if "height" in t
            ]
            tide_hourly = [
                TideHourlyInput(
                    fxTime=h.get("fxTime", ""), height=h.get("height", "")
                )
                for h in tide.get("tideHourly", [])
            ]
            tide_data = TideDataInput(
                updateTime=tide.get("updateTime"),
                tideTable=tide_table,
                tideHourly=tide_hourly,
            )

        return WeatherAnalysisInputSchema(
            fishing_index=fishing_index,
            live_weather=live_weather,
            forecasts=forecasts,
            tide_data=tide_data,
            location_name=data.get("locationName"),
            tide_spot_name=data.get("tideSpotName"),
        )
