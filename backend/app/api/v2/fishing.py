"""
钓鱼指数 API 路由
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from pydantic import BaseModel, Field
from redis.asyncio import Redis as AsyncRedis

from app.api.des.auth import manager
from app.api.des.redis import get_redis
from app.appstate import AppState, get_app_state
from app.core.exceptions import APIError
from app.core.response import APIResponse
from app.plugins.cache import redis_cache
from app.services.fishing.fishing_index import (
    FEEDBACK_SCORES,
    FishingRecord,
    build_record,
    get_level,
    get_qweather_index,
    parse_tide_info,
)
from app.services.weather_service import weather_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fishing", tags=["fishing"])


async def _safe_invalidate(*func_names: str) -> None:
    """写后清理缓存。失败降级为日志,不影响主流程。"""
    try:
        await redis_cache.invalidate(*func_names)
    except Exception:
        logger.exception("cache invalidation failed (non-fatal)")


class FishingIndexResponse(BaseModel):
    """钓鱼指数响应"""

    fishing_index: int = Field(..., description="钓鱼指数 0-100")
    expert_score: int = Field(..., description="专家评分")
    residual: float = Field(..., description="个性化校正量")
    level: Literal["爆护", "好", "一般", "差", "空军"] = Field(
        ..., description="钓鱼等级"
    )
    feature_breakdown: dict[str, float] = Field(
        default_factory=dict, description="各特征评分"
    )
    # enriched 模式下附加的天气数据
    current_weather: dict | None = Field(
        default=None, description="当前天气（enriched=True 时填充）"
    )
    forecasts: list[dict] | None = Field(
        default=None, description="天气预报列表（enriched=True 时填充）"
    )
    location_name: str | None = Field(
        default=None, description="位置名称（enriched=True 时填充）"
    )
    tide_data: dict | None = Field(
        default=None, description="潮汐数据（enriched=True 时填充）"
    )
    hourly_weather: dict | None = Field(
        default=None, description="小时天气预报（enriched=True 时填充）"
    )


class FishingFeedbackRequest(BaseModel):
    """钓鱼反馈请求"""

    location_id: str = Field(..., description="钓点ID")
    location_name: str = Field(..., description="钓点名称")
    fishing_time: str = Field(..., description="钓鱼时间")

    # 天气数据
    temperature: float = Field(20.0, description="温度 °C")
    humidity: float = Field(50.0, description="湿度 %")
    pressure: float = Field(1013.0, description="气压 hPa")
    wind_speed: float = Field(0.0, description="风速 m/s")
    precipitation: float = Field(0.0, description="降水量 mm")
    indices: int = Field(2, description="和风指数 1-3")

    # 潮汐数据
    tide_level: float = Field(1.0, description="潮位 m")
    tide_type: Literal["涨潮", "退潮"] = Field("涨潮", description="高潮/低潮")
    tide_range: float = Field(1.5, description="潮差 m")
    hours_to_next_tide: float = Field(
        3.0, description="距下一潮汐时间（小时）"
    )

    # 反馈
    feedback: Literal["爆护", "好", "一般", "差", "空军"] = Field(
        ..., description="钓鱼体验"
    )


class FishingFeedbackResponse(BaseModel):
    """钓鱼反馈响应"""

    success: bool
    record_id: str
    expert_score: int
    residual: int


def _build_record_from_request(req: FishingFeedbackRequest) -> dict:
    """从请求构建钓鱼记录 dict"""
    return {
        "temperature": req.temperature,
        "humidity": req.humidity,
        "pressure": req.pressure,
        "wind_speed": req.wind_speed,
        "precipitation": req.precipitation,
        "tide_type": req.tide_type,
        "hours_to_tide": req.hours_to_next_tide,
        "tide_range": req.tide_range,
        "indices": req.indices,
    }


@router.get("/index")
@redis_cache(ttl=300, exclude=["redis", "state"])
async def get_fishing_index(
    location: str = Query(..., description="经纬度坐标，格式为 'lng,lat'"),
    enriched: bool = Query(False, description="是否附加天气数据"),
    redis: AsyncRedis = Depends(get_redis),
    state: AppState = Depends(get_app_state),
) -> APIResponse:
    """
    获取指定地点的钓鱼指数

    基于专家公式计算基础分数 + sklearn 个性化校正
    当 enriched=True 时，响应中附加天气数据（当前天气/预报/位置名/潮汐）
    """
    logger.info(
        f"[钓鱼指数] 收到请求 location={location}, enriched={enriched}"
    )
    try:
        # 天气数据由 Go 后端 /v3/weather/full 提供（并发请求 QWeather + 缓存），
        # Python 端保留钓鱼指数计算逻辑。
        weather_data = await weather_service.get_full_weather_data_from_go(
            location
        )
        logger.info(
            f"[钓鱼指数] 从 Go 后端获取天气数据成功: {list(weather_data.keys())}"
        )
    except Exception as e:
        logger.error(f"[钓鱼指数] 获取天气数据失败: {e!r}", exc_info=True)
        raise APIError(message="无法获取天气数据，请稍后再试") from None

    # 解析潮汐数据
    tide_data = weather_data.get("tide", {})
    tide_info = parse_tide_info(tide_data)

    # 获取和风指数
    indices = get_qweather_index(weather_data)

    # 构建钓鱼记录
    record = build_record(weather_data, tide_info, indices)

    # 计算钓鱼指数
    fishing_index, expert_score, residual, feature_breakdown = (
        state.fishing_svc.calculate_fishing_index(record)
    )
    logger.info(
        f"[钓鱼指数] 计算完成: index={fishing_index}, expert={expert_score}, residual={residual}"
    )

    resp_data = FishingIndexResponse(
        fishing_index=fishing_index,
        expert_score=expert_score,
        residual=residual,
        level=get_level(fishing_index),
        feature_breakdown={
            k: round(v, 2) for k, v in feature_breakdown.items()
        },
    )

    # enriched 模式下附加天气数据
    if enriched:
        resp_data.current_weather = weather_data.get("current", {}).get("now")
        resp_data.forecasts = weather_data.get("daily", {}).get("daily")
        resp_data.location_name = weather_data.get("locationName")
        resp_data.tide_data = weather_data.get("tide")
        resp_data.hourly_weather = weather_data.get("hourly", {})

    return APIResponse(data=resp_data.model_dump())


@router.post("/feedback")
async def submit_feedback(
    payload: FishingFeedbackRequest,
    background_tasks: BackgroundTasks,
    _: AsyncRedis = Depends(get_redis),
    state: AppState = Depends(get_app_state),
) -> APIResponse:
    """
    提交钓鱼反馈

    用户提交反馈后，系统计算残差并保存到 MongoDB
    """
    record = _build_record_from_request(payload)

    # 通过服务的 calculate_fishing_index 统一计算（专家 + 模型残差）
    fishing_record = FishingRecord(
        temperature=payload.temperature,
        humidity=payload.humidity,
        pressure=payload.pressure,
        wind_speed=payload.wind_speed,
        precipitation=payload.precipitation,
        tide_type=payload.tide_type,
        hours_to_next_tide=payload.hours_to_next_tide,
        tide_range=payload.tide_range,
        indices=payload.indices,
    )
    _fishing_idx, expert_score_from_svc, _residual, _features = (
        state.fishing_svc.calculate_fishing_index(fishing_record)
    )

    # 用户实际评分
    actual_score = FEEDBACK_SCORES[payload.feedback]

    # 残差 = 实际 - 专家
    residual = actual_score - expert_score_from_svc

    # 保存到 MongoDB
    doc_data = {
        "location_id": payload.location_id,
        "location_name": payload.location_name,
        "fishing_time": payload.fishing_time,
        **record,
        "feedback": payload.feedback,
        "feedback_score": actual_score,
        "expert_score": expert_score_from_svc,
    }
    record_id = await state.fishing_svc.save_feedback(doc_data)
    logger.info(f"[钓鱼反馈] 已保存记录: {record_id}")

    # 反馈数据进入训练集，会改变模型残差 → 让缓存的指数最多存在 5 分钟
    await _safe_invalidate("get_fishing_index")

    # 自动训练检查（异步，不阻塞响应）
    background_tasks.add_task(
        state.fishing_svc.auto_train_if_needed, source="all"
    )

    return APIResponse(
        data=FishingFeedbackResponse(
            success=True,
            record_id=str(record_id),
            expert_score=int(expert_score_from_svc),
            residual=int(residual),
        ).model_dump(),
        message=f"反馈已记录：{payload.feedback}",
    )


@router.get("/stats")
async def get_fishing_stats(
    state: AppState = Depends(get_app_state),
) -> APIResponse:
    """获取钓鱼统计数据（总记录数 + 最近记录时间）"""
    stats = await state.fishing_svc.get_stats()
    return APIResponse(data=stats)


@router.get("/weights")
async def get_weights(
    _: int = Depends(manager),
    state: AppState = Depends(get_app_state),
):
    """
    查看模型权重

    返回专家权重和 sklearn 残差模型权重
    """
    expert_weights = state.fishing_svc.expert.WEIGHTS
    residual_weights = state.fishing_svc.model_svc.get_weights()

    return APIResponse(
        data={
            "expert_weights": expert_weights,
            "residual_weights": residual_weights,
        },
    )
