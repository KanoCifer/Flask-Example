import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SQLITE_PREFIX = "sqlite:///"

SECRET_KEY = os.getenv("SECRET_KEY", "dev")
SQLALCHEMY_DATABASE_URI = os.getenv(
    "DATABASE_URL", SQLITE_PREFIX + str(BASE_DIR / "data.db")
)
SQLALCHEMY_TRACK_MODIFICATIONS = False
