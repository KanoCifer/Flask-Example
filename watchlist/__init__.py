import os
from pathlib import Path

from flask import Flask

from watchlist.auth import auth_bp
from watchlist.commands import admin, forge
from watchlist.extensions import db, login_manager
from watchlist.models import User
from watchlist.views import main_bp

BASE_DIR = Path(__file__).resolve().parent
SQLITE_PREFIX = "sqlite:///"


def create_app(test_config=None):
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL", SQLITE_PREFIX + str(BASE_DIR / "data.db")
    )

    if test_config:
        app.config.update(test_config)

    register_extensions(app)
    register_blueprints(app)
    register_commands(app)
    register_errors(app)

    return app


def register_extensions(app):
    db.init_app(app)
    login_manager.init_app(app)


def register_blueprints(app):
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)


def register_commands(app):
    app.cli.add_command(forge)
    app.cli.add_command(admin)


def register_errors(app):
    @app.errorhandler(404)
    def page_not_found(error):
        from flask import render_template

        return render_template("404.html"), 404


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))
