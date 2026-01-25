from flask import Blueprint, flash, jsonify, redirect, render_template, url_for
from flask_login import current_user, login_required
from sqlalchemy import select, text

from watchlist.extensions import db
from watchlist.forms import BookForm, SettingsForm
from watchlist.models import Book, User

main_bp = Blueprint("main", __name__)


# 首页视图，显示书籍列表并处理添加书籍的表单提交
@main_bp.route("/", methods=["GET", "POST"])
@main_bp.route("/index", methods=["GET", "POST"])
def index():
    form = BookForm()
    if form.validate_on_submit():
        if not current_user.is_authenticated:
            flash("You must log in first.")
            return redirect(url_for("main.index"))
        title = (form.title.data or "").strip().title()
        author = (form.author.data or "").strip()
        book = Book()
        book.title = title
        book.author = author
        book.user_id = current_user.id
        db.session.add(book)
        db.session.commit()
        flash("Item created.")
        return redirect(url_for("main.index"))
    if current_user.is_authenticated:
        user = current_user
    else:
        user = db.session.execute(select(User).filter_by(id=1)).scalar()
    user_id = user.id if user else 1
    books = (
        db.session.execute(
            select(Book)
            .filter_by(user_id=user_id)
            .order_by(text("iscompleted, add_date DESC"))
        )
        .scalars()
        .all()
    )
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


# 删除书籍的路由
@main_bp.route("/book/delete/<int:book_id>", methods=["POST"])
@login_required
def delete(book_id):
    book = db.get_or_404(Book, book_id)
    db.session.delete(book)
    db.session.commit()
    flash("Item deleted.")
    return redirect(url_for("main.index"))


# 用户设置视图，允许用户更新个人信息
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


@main_bp.route("/upload_pic", methods=["POST"])
@login_required
def upload_pic():
    return jsonify({"status": "success", "message": "Picture uploaded."})
