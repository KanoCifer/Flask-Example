"""v2 translate API — 通用翻译（登录 / 匿名均可用，参考 learning 路由）。

限流：``@limiter.limit`` 按 IP（``client_key``）计数，匿名用户同样命中；
超过阈值返回 429。
"""

from fastapi import APIRouter, Depends, Request

from app.api.des.auth import optional_user
from app.api.des.limiter import limiter
from app.appstate import AppState, get_app_state
from app.core.response import APIResponse
from app.schemas.translate import TranslateRequest, TranslateResult
from app.services.translate import TranslateService

router = APIRouter(prefix="/translate", tags=["translate"])


@router.post("", response_model=APIResponse[TranslateResult])
@limiter.limit("20/minute")
async def translate(
    request: Request,
    payload: TranslateRequest,
    user: int | None = Depends(optional_user),
    state: AppState = Depends(get_app_state),
):
    """通用翻译：把 ``text`` 翻译成 ``target_lang``，返回 ``{text}``。

    ``usage``（token 消耗）随 ``data`` 返回；匿名用户 ``user_id`` 为 None，
    落库时记为 NULL，不落 IP。
    """
    svc: TranslateService = state.translate_svc
    result = await svc.translate(payload.text, payload.target_lang, user_id=user)
    return APIResponse(data=result, message="success")
