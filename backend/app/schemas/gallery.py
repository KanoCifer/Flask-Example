from pydantic import BaseModel, Field


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
