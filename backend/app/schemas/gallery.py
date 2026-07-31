from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class GalleryImage(BaseModel):
    """照片墙中的单张图片信息。

    输入输出共用：新增字段均为可选，前端回传最小 payload 时不携带也不会报错，
    服务端以重新处理的结果为准（不回写）。
    """

    id: str
    uploadedAt: str | None = Field(
        default=None, description="图片上传时间，ISO格式字符串"
    )
    url: str
    description: str
    exif: dict[str, str] | None = Field(
        default=None, description="图片的EXIF信息"
    )
    thumbnailUrl: str | None = Field(
        default=None, description="缩略图相对媒体根路径"
    )
    mediumUrl: str | None = Field(
        default=None, description="中等尺寸相对媒体根路径"
    )
    width: int | None = Field(default=None, description="原图宽度(px)")
    height: int | None = Field(default=None, description="原图高度(px)")
    aspectRatio: float | None = Field(default=None, description="宽高比(宽/高)")
    fileSize: int | None = Field(default=None, description="原图文件大小(字节)")
    mimeType: str | None = Field(default=None, description="原图 MIME 类型")
    status: str | None = Field(
        default=None, description="图片处理状态(uploaded/processing/ready/failed)"
    )


class GalleryInput(BaseModel):
    """照片墙输入体"""

    images: list[GalleryImage] = Field(
        default_factory=list, description="图片列表"
    )


class GalleryResponse(BaseModel):
    """照片墙响应体"""

    images: list[GalleryImage] = Field(
        default_factory=list, description="图片列表"
    )


class UpdateImagePayload(BaseModel):
    """管理员编辑单图元数据的 partial payload。

    PATCH 语义（JSON Merge）：三个字段均可选，未传或传 None 表示「不动该字段」。
    """

    description: str | None = Field(default=None, description="图片描述")
    uploadedAt: str | None = Field(
        default=None, description="图片上传时间，ISO格式字符串"
    )
    exif: dict[str, str] | None = Field(
        default=None, description="图片的EXIF信息；空对象 {} 表示清空"
    )

    @field_validator("uploadedAt")
    @classmethod
    def _validate_uploaded_at(cls, value: str | None) -> str | None:
        if value is None:
            return value
        # 校验可被 fromisoformat 解析（Python 3.11+ 原生支持 Z 后缀），
        # 失败抛 ValueError 由 FastAPI 转 422。
        datetime.fromisoformat(value)
        return value
