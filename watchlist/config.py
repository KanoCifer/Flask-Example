import os
from pathlib import Path

# Configuration settings
BASE_DIR = Path(__file__).resolve().parent
SQLITE_PREFIX = "sqlite:///"
MEDIA_PATH = BASE_DIR / "media"

SECRET_KEY = os.getenv("SECRET_KEY", "dev")
SQLALCHEMY_DATABASE_URI = os.getenv(
    "DATABASE_URL", SQLITE_PREFIX + str(BASE_DIR / "data.db")
)
SQLALCHEMY_TRACK_MODIFICATIONS = False


# Mail settings
MAIL_SERVER = "smtp.qq.com"
MAIL_PORT = 465
MAIL_USE_TLS = False
MAIL_USE_SSL = True
MAIL_USERNAME = "kanocifer@qq.com"
MAIL_PASSWORD = "xllwekwpvxkidhhd"
MAIL_DEFAULT_SENDER = ("Watchlist", MAIL_USERNAME)
