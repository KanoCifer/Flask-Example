from datetime import datetime
from typing import Optional

import faker
from flask_login import UserMixin
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from werkzeug.security import check_password_hash, generate_password_hash

from watchlist.extensions import db

fake = faker.Faker()


class User(db.Model, UserMixin):
    __tablename__ = "user"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), default=fake.name())
    username: Mapped[str] = mapped_column(String(50), unique=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(200))
    # One-to-One relationship with Profile
    profile: Mapped[Optional["Profile"]] = relationship(
        back_populates="user", uselist=False
    )
    # One-to-Many relationship with Book
    books: Mapped[list["Book"]] = relationship(back_populates="user")

    def __init__(self, username: str):
        self.username = username

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def validate_password(self, password):
        if self.password_hash is None:
            return False
        return check_password_hash(self.password_hash, password)


class Profile(db.Model):
    __tablename__ = "profile"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=True)
    gender: Mapped[str] = mapped_column(String(10), nullable=True)
    mobile: Mapped[str] = mapped_column(String(15), nullable=True)
    # Foreign Key to User
    user_id: Mapped[int] = mapped_column(db.ForeignKey("user.id"))
    # One-to-One relationship with User
    user: Mapped["User"] = relationship(back_populates="profile")


class Book(db.Model):
    __tablename__ = "book"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(100), unique=True)
    author: Mapped[str] = mapped_column(String(60))
    iscompleted: Mapped[bool] = mapped_column(default=False)
    add_date: Mapped[str] = mapped_column(String(20), default=datetime.now)

    # Foreign Key to User
    user_id: Mapped[int] = mapped_column(db.ForeignKey("user.id"))
    user: Mapped["User"] = relationship(
        back_populates="books"
    )  # Establish relationship with User


class SignUpCode(db.Model):
    __tablename__ = "signup_code"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(100), unique=True)
    code: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(db.DateTime, default=datetime.now)

    def __init__(self, email: str, code: str):
        self.email = email
        self.code = code
