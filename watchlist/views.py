from flask import Blueprint, flash, jsonify, redirect, render_template, url_for
from flask_login import current_user, login_required
from sqlalchemy import select, text

from watchlist.extensions import db
from watchlist.forms import BookForm, SettingsForm
from watchlist.models import Book, Profile

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
        user_books = (
            db.session.execute(
                select(Book)
                .filter_by(user_id=current_user.id)
                .order_by(text("iscompleted, add_date DESC"))
            )
            .scalars()
            .all()
        )
    else:
        user_books = []

    owner_books = (
        db.session.execute(
            select(Book)
            .filter_by(user_id=1)
            .order_by(text("iscompleted, add_date DESC"))
        )
        .scalars()
        .all()
    )

    return render_template(
        "index.html", user_books=user_books, owner_books=owner_books, form=form
    )


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
        gender = form.gender.data
        email = form.email.data
        mobile = form.mobile.data

        current_user.name = name
        current_user.username = username
        # Ensure the user has a profile
        if current_user.profile is None:
            current_user.profile = Profile(user_id=current_user.id)

        current_user.profile.gender = gender
        current_user.profile.email = email
        current_user.profile.mobile = mobile

        if password:
            current_user.set_password(password)

        db.session.commit()
        flash("Settings updated.")
        return redirect(url_for("main.index"))

    form.name.data = current_user.name
    form.username.data = current_user.username
    if current_user.profile:
        if current_user.profile.email is not None:
            form.email.data = current_user.profile.email
        if current_user.profile.mobile is not None:
            form.mobile.data = current_user.profile.mobile
        if current_user.profile.gender is not None:
            form.gender.data = current_user.profile.gender

    return render_template("settings.html", form=form)


@main_bp.route("/upload_pic", methods=["POST"])
@login_required
def upload_pic():
    return jsonify({"status": "success", "message": "Picture uploaded."})
