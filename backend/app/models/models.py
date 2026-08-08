from __future__ import annotations

from datetime import UTC, datetime

from fastapi import Request
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship
from werkzeug.security import check_password_hash

from app.models import Base


# 用户模型
class User(Base):
    __tablename__ = "user"
    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    github_id: Mapped[int | None] = mapped_column(
        Integer, unique=True, nullable=True
    )
    name: Mapped[str] = mapped_column(String(50), index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))

    # ========== Trackable 功能字段（你重点关注的）==========
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    current_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_ip: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    current_login_ip: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    login_count: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=False)

    # One-to-One relationship with Profile
    profile: Mapped[Profile | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    # 一对多关系与订阅（sub_repo selectinload 使用）
    subscriptions: Mapped[list[Subscription]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    # 一对一关系与PasskeyCredential
    passkey_credential: Mapped[PasskeyCredential | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    def __init__(self, *args, **kwargs):
        """允许在初始化时直接传入 password 参数并自动生成哈希值.

        name 未显式提供时回落为 username（name 列 NOT NULL）。
        """
        password = kwargs.pop("password", None)
        if "name" not in kwargs:
            kwargs["name"] = kwargs.get("username", "")
        super().__init__(*args, **kwargs)
        if password:
            self.set_password(password)  # 自动生成 bcrypt 哈希

    # 获取用户的真实 IP 地址，考虑了代理服务器的情况
    @staticmethod
    def get_real_ip(request: Request) -> str:
        """
        获取客户端真实 IP,处理了反向代理 Nginx 的情况

        约定与 app/api/des/limiter.py 的 client_key 一致：nginx 用
        `$proxy_add_x_forwarded_for` 把真实来源 IP 追加在 X-Forwarded-For 末段，
        因此取**最右一个非空项**（客户端伪造的首段被忽略）。可信来源的判定由
        uvicorn 的 ProxyHeadersMiddleware（TRUSTED_PROXIES）完成，此处只做取段。
        """
        # 1. 尝试从 X-Forwarded-For 获取（nginx 追加的末段才是真实客户端）
        x_forwarded_for = request.headers.get("X-Forwarded-For")
        if x_forwarded_for:
            # 可能是 "client_ip, proxy1_ip, proxy2_ip" 的格式
            for item in reversed(x_forwarded_for.split(",")):
                ip = item.strip()
                if ip:
                    return ip

        # 2. 尝试从 X-Real-IP 获取（常见于简单的单层代理配置）
        x_real_ip = request.headers.get("X-Real-IP")
        if x_real_ip:
            return x_real_ip

        # 3. 直接获取连接方 IP（如果没有代理，或者是直连）
        # 注意：FastAPI 中通过 request.client 获取，它是一个 Address 对象
        return request.client.host if request.client else "127.0.0.1"

    # 验证密码
    def validate_password(self, password: str) -> bool:
        """验证密码,兼容 bcrypt 与 werkzeug pbkdf2 两种哈希格式.

        新注册 / 密码修改统一使用 bcrypt(前缀 ``$2b$``);存量用户仍使用
        werkzeug 默认的 pbkdf2:sha256。通过哈希前缀自动分流。
        """
        if self.password_hash is None:
            return False
        # 兼容所有 bcrypt 变体: $2a$(Go / 早期实现) / $2b$(Python 默认) / $2y$
        if (
            self.password_hash[:3] in ("$2a", "$2b", "$2y")
            and self.password_hash[3:4] == "$"
        ):
            import bcrypt

            return bcrypt.checkpw(
                password.encode(), self.password_hash.encode()
            )
        return check_password_hash(self.password_hash, password)

    def needs_hash_upgrade(self) -> bool:
        """True 表示当前哈希是旧格式(pbkdf2),登录成功后应静默升级到 bcrypt."""
        if self.password_hash is None:
            return False
        return not (
            self.password_hash[:3] in ("$2a", "$2b", "$2y")
            and self.password_hash[3:4] == "$"
        )

    @property
    def is_admin(self) -> bool:
        """检查用户是否在管理员白名单中，由 settings.ADMIN_USER_IDS 配置。"""
        from app.core.config import settings

        return self.id in settings.ADMIN_USER_IDS

    def set_password(self, raw_password: str) -> None:
        """设置密码时使用 bcrypt 哈希(与 Go 端对齐)."""
        import bcrypt

        self.password_hash = bcrypt.hashpw(
            raw_password.encode(), bcrypt.gensalt()
        ).decode()


# 一对一关系的用户资料模型
class Profile(Base):
    __tablename__ = "profile"
    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    email: Mapped[str | None] = mapped_column(
        String(100), unique=True, nullable=True
    )
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(15), nullable=True)
    # Foreign Key to User (unique=True ensures one-to-one)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id"), unique=True
    )
    # One-to-One relationship with User
    user: Mapped[User] = relationship(back_populates="profile")
    photo: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default="default.png"
    )

    bark_device_key: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    feishu_webhook_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )


class RssInfo(Base):
    __tablename__ = "rss_info"
    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    rss_url: Mapped[str] = mapped_column(String(200), index=True)
    feed_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    feed_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    feed_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    feed_published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    entry_count: Mapped[int] = mapped_column(Integer, default=0)
    last_fetched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # 一对多关系，一个用户可以有多个RSS链接
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id"), index=True
    )


class PasskeyCredential(Base):
    __tablename__ = "passkey_credential"
    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    credential_id: Mapped[str] = mapped_column(String(255), unique=True)
    public_key: Mapped[str] = mapped_column(String(500))
    sign_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id"), index=True
    )
    # 一对一
    user: Mapped[User] = relationship(
        back_populates="passkey_credential", uselist=False
    )


class Subscription(Base):
    __tablename__ = "subscription"
    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)

    price: Mapped[float] = mapped_column(Float, nullable=False)

    currency: Mapped[str] = mapped_column(String(10), nullable=False)

    billing_cycle: Mapped[str] = mapped_column(
        Enum("monthly", "quarterly", "yearly", name="billing_cycle_enum"),
        nullable=False,
    )

    next_billing_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    status: Mapped[str] = mapped_column(
        Enum(
            "active",
            "canceled",
            "paused",
            "expired",
            name="subscription_status_enum",
        ),
        nullable=False,
    )
    reminder_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id"), index=True
    )
    user: Mapped[User] = relationship(back_populates="subscriptions")


class DeviceTrack(Base):
    __tablename__ = "device_track"
    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    purchase_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    price: Mapped[float] = mapped_column(Float)
    currency: MappedColumn[str] = mapped_column(String(10), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    status: Mapped[str] = mapped_column(
        Enum("active", "retired", name="device_status_enum"),
        nullable=False,
    )
    reminder_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class GalleryImage(Base):
    """持久化的画廊图片记录"""

    __tablename__ = "gallery_image"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )

    # 原图
    url: Mapped[str] = mapped_column(String(500), nullable=False)

    # 缩略图
    thumbnail_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )

    # 中等尺寸
    medium_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # 图片信息
    width: Mapped[int] = mapped_column(Integer, default=0)

    height: Mapped[int] = mapped_column(Integer, default=0)

    aspect_ratio: Mapped[float] = mapped_column(Float, default=0)

    file_size: Mapped[int] = mapped_column(Integer, default=0)

    mime_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default="image/jpeg", server_default="image/jpeg"
    )

    # 描述
    description: Mapped[str] = mapped_column(String(500), default="")

    # 排序
    sort_order: Mapped[int] = mapped_column(Integer, default=0, index=True)

    # 图片处理状态
    # uploaded
    # processing
    # ready
    # failed
    status: Mapped[str] = mapped_column(
        String(20), default="uploaded", index=True
    )

    # EXIF
    exif: Mapped[dict | None] = mapped_column(JSONB, default=None)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("user.id"), nullable=True, index=True
    )
