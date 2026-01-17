from flask import Blueprint, flash, redirect, render_template, url_for
from flask_login import login_required, login_user, logout_user
from sqlalchemy import select

from watchlist.extensions import db
from watchlist.forms import QLoginForm
from watchlist.models import User

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    form = QLoginForm()
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data

        user = db.session.execute(select(User).filter_by(username=username)).scalar()

        if user and user.validate_password(password):
            login_user(user)
            flash("Login success.")
            return redirect(url_for("main.index"))

        flash("Invalid username or password.")
        return redirect(url_for("auth.login"))

    return render_template("login.html", form=form)


@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You have been logged out.")
    return redirect(url_for("main.index"))
