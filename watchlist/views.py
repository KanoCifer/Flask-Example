from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import select, text

from watchlist.extensions import db
from watchlist.forms import BookForm, SettingsForm
from watchlist.models import Book, User

main_bp = Blueprint("main", __name__)


@main_bp.route("/", methods=["GET", "POST"])
@main_bp.route("/index", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        if not current_user.is_authenticated:
            return redirect(url_for("main.index"))
    form = BookForm()
    if form.validate_on_submit():
        title = (form.title.data or "").strip().title()
        author = (form.author.data or "").strip()
        book = Book()
        book.title = title
        book.author = author
        db.session.add(book)
        db.session.commit()
        flash("Item created.")
        return redirect(url_for("main.index"))

    user = (
        current_user.name
        if current_user.is_authenticated
        else db.session.execute(select(User.name).filter_by(id=1)).scalar()
    )
    books = db.session.execute(text("SELECT * FROM book")).mappings().all()
    return render_template("index.html", user=user, books=books, form=form)


@main_bp.route("/book/edit/<int:book_id>", methods=["GET", "POST"])
@login_required
def edit(book_id):
    book = db.get_or_404(Book, book_id)
    form = BookForm(obj=book)

    if form.validate_on_submit():
        title = (form.title.data or "").strip().title()
        author = (form.author.data or "").strip()

        book.title = title
        book.author = author
        db.session.commit()
        flash("Item updated.")
        return redirect(url_for("main.index"))

    return render_template("edit.html", book=book, form=form)


@main_bp.route("/book/delete/<int:book_id>", methods=["POST"])
@login_required
def delete(book_id):
    book = db.get_or_404(Book, book_id)
    db.session.delete(book)
    db.session.commit()
    flash("Item deleted.")
    return redirect(url_for("main.index"))


@main_bp.route("/settings", methods=["GET", "POST"])
@login_required
def settings():
    form = SettingsForm()
    if form.validate_on_submit():
        name = form.name.data
        username = form.username.data
        password = form.password.data

        if not name or len(name) > 20:
            flash("Invalid name input.")
            return redirect(url_for("main.settings"))

        if not username or len(username) > 20:
            flash("Invalid username input.")
            return redirect(url_for("main.settings"))

        current_user.name = name
        current_user.username = username

        if password:
            current_user.set_password(password)

        db.session.commit()
        flash("Settings updated.")
        return redirect(url_for("main.index"))

    form.name.data = current_user.name
    form.username.data = current_user.username

    return render_template("settings.html", form=form)
