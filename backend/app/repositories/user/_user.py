from __future__ import annotations

from datetime import UTC, datetime

import bcrypt
from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import logger
from app.models.models import User


class UserMixin:
    """User 表 CRUD 操作。"""

    # ------------------------------------------------------------------ #
    # Query
    # ------------------------------------------------------------------ #

    async def get_by_id(
        self,
        session: AsyncSession,
        user_id: int,
        *,
        with_profile: bool = False,
        with_passkey: bool = False,
    ) -> User | None:
        """
        根据用户 ID 查询用户。

        :param session: 数据库会话
        :param user_id: 用户 ID
        :param with_profile: 是否预加载 profile 关联
        :param with_passkey: 是否预加载 passkey 关联
        :return: 用户对象或 None
        """
        stmt = select(User).where(User.id == user_id)
        if with_profile:
            stmt = stmt.options(selectinload(User.profile))
        if with_passkey:
            stmt = stmt.options(selectinload(User.passkey_credential))
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_username(
        self,
        session: AsyncSession,
        username: str,
    ) -> User | None:
        """
        根据用户名查询用户（不含关联）。

        :param session: 数据库会话
        :param username: 用户名
        :return: 用户对象或 None
        """
        result = await session.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def get_by_username_with_relations(
        self,
        session: AsyncSession,
        username: str,
    ) -> User | None:
        """
        根据用户名查询用户，预加载 profile 和 passkey。

        :param session: 数据库会话
        :param username: 用户名
        :return: 用户对象或 None
        """
        result = await session.execute(
            select(User)
            .where(User.username == username)
            .options(
                selectinload(User.profile),
                selectinload(User.passkey_credential),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_github_id(
        self,
        session: AsyncSession,
        github_id: int,
    ) -> User | None:
        """
        根据 GitHub ID 查询用户。

        :param session: 数据库会话
        :param github_id: GitHub 用户 ID
        :return: 用户对象或 None
        """
        result = await session.execute(
            select(User)
            .where(User.github_id == github_id)
            .options(
                selectinload(User.profile),
                selectinload(User.passkey_credential),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_email(
        self,
        session: AsyncSession,
        email: str,
    ) -> User | None:
        """
        通过邮箱地址查询用户（JOIN Profile 表）。

        :param session: 数据库会话
        :param email: 邮箱地址
        :return: 用户对象或 None
        """
        from app.models.models import Profile

        result = await session.execute(
            select(User)
            .join(Profile)
            .where(Profile.email == email)
            .options(
                selectinload(User.profile),
                selectinload(User.passkey_credential),
            )
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # Create / Update
    # ------------------------------------------------------------------ #

    async def create_user(
        self,
        session: AsyncSession,
        username: str,
        password: str,
        name: str | None = None,
        github_id: int | None = None,
    ) -> User:
        """
        创建新用户。

        :param session: 数据库会话
        :param username: 用户名
        :param password: 明文密码（会自动哈希）
        :param name: 显示名称，默认同用户名
        :param github_id: GitHub ID（OAuth 登录时使用）
        :return: 已创建的用户对象
        """
        user = User(
            username=username,
            github_id=github_id,
            name=name or username,
        )
        user.set_password(password)
        session.add(user)
        await session.flush()
        return user

    async def update_login_info(
        self,
        session: AsyncSession,
        user: User,
        request: Request,
    ) -> None:
        """
        更新用户登录信息（时间戳、IP、计数）。

        :param session: 数据库会话
        :param user: 用户对象
        :param request: FastAPI 请求对象，用于提取客户端 IP
        """
        user.active = True
        user.last_login_at = user.current_login_at
        user.current_login_at = datetime.now(UTC)
        user.last_login_ip = user.current_login_ip
        user.current_login_ip = User.get_real_ip(request)
        user.login_count += 1

    async def set_github_id(
        self,
        session: AsyncSession,
        user: User,
        github_id: int | None,
    ) -> None:
        """
        设置或清除用户的 GitHub ID 绑定。

        :param session: 数据库会话
        :param user: 用户对象
        :param github_id: GitHub ID，传 None 则解除绑定
        """
        user.github_id = github_id
        await session.flush()

    async def set_active_by_id(
        self,
        session: AsyncSession,
        user_id: int,
        active: bool,
    ) -> None:
        """
        根据用户 ID 设置在线状态（直接执行 UPDATE 语句）。

        用于处理 detached 的 user 对象场景（如 logout）。

        :param session: 数据库会话
        :param user_id: 用户 ID
        :param active: 是否在线
        """
        stmt = update(User).where(User.id == user_id).values(active=active)
        await session.execute(stmt)
        await session.flush()
        logger.info(f"Set user {user_id} active={active}")

    async def set_password(
        self,
        session: AsyncSession,
        user: User,
        password: str,
    ) -> None:
        """
        更新用户密码（bcrypt 哈希）。

        :param session: 数据库会话
        :param user: 用户对象
        :param password: 明文密码
        """
        user.password_hash = bcrypt.hashpw(
            password.encode(), bcrypt.gensalt()
        ).decode()
        await session.flush()

    async def set_name(
        self,
        session: AsyncSession,
        user: User,
        name: str,
    ) -> None:
        """
        更新用户显示名称。

        :param session: 数据库会话
        :param user: 用户对象
        :param name: 新的显示名称
        """
        user.name = name
        await session.flush()

    async def set_username(
        self,
        session: AsyncSession,
        user: User,
        username: str,
    ) -> None:
        """
        更新用户名。

        :param session: 数据库会话
        :param user: 用户对象
        :param username: 新的用户名
        """
        user.username = username
        await session.flush()

    async def set_username_by_id(
        self,
        session: AsyncSession,
        user_id: int,
        username: str,
    ) -> None:
        """
        根据用户 ID 更新用户名（直接执行 UPDATE 语句）。

        用于处理 detached 的 user 对象场景。

        :param session: 数据库会话
        :param user_id: 用户 ID
        :param username: 新的用户名
        """
        stmt = update(User).where(User.id == user_id).values(username=username)
        await session.execute(stmt)
        await session.flush()

    async def set_name_by_id(
        self,
        session: AsyncSession,
        user_id: int,
        name: str,
    ) -> None:
        """
        根据用户 ID 更新显示名称（直接执行 UPDATE 语句）。

        用于处理 detached 的 user 对象场景。

        :param session: 数据库会话
        :param user_id: 用户 ID
        :param name: 新的显示名称
        """
        stmt = update(User).where(User.id == user_id).values(name=name)
        await session.execute(stmt)
        await session.flush()

    async def set_password_by_id(
        self,
        session: AsyncSession,
        user_id: int,
        password: str,
    ) -> None:
        """
        根据用户 ID 更新密码（bcrypt 哈希,直接执行 UPDATE 语句）。

        用于处理 detached 的 user 对象场景。

        :param session: 数据库会话
        :param user_id: 用户 ID
        :param password: 明文密码
        """
        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        stmt = (
            update(User)
            .where(User.id == user_id)
            .values(password_hash=hashed)
        )
        await session.execute(stmt)
        await session.flush()

    # ------------------------------------------------------------------ #
    # Misc
    # ------------------------------------------------------------------ #

    async def is_username_taken(
        self,
        session: AsyncSession,
        username: str,
        *,
        exclude_user_id: int | None = None,
    ) -> bool:
        """
        检查用户名是否已被占用。

        :param session: 数据库会话
        :param username: 用户名
        :param exclude_user_id: 排除的用户 ID（更新自身时使用）
        :return: True 表示已被占用
        """
        stmt = select(User).where(User.username == username)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        if user is None:
            return False
        return not (exclude_user_id and user.id == exclude_user_id)

    async def refresh_user(
        self,
        session: AsyncSession,
        user: User,
    ) -> None:
        """
        从数据库刷新用户对象状态。

        :param session: 数据库会话
        :param user: 用户对象
        """
        await session.refresh(user)
