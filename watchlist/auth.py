import random

from flask import (
    Blueprint,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
)
from flask_login import login_required, login_user, logout_user
from flask_mail import Message
from sqlalchemy import select

from watchlist.extensions import db, mail
from watchlist.forms import QLoginForm, SignUpForm
from watchlist.models import Profile, SignUpCode, User

# 蓝图对象【auth_bp】，用于认证相关的路由
auth_bp = Blueprint("auth", __name__)


# 登录的路由
@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    form = QLoginForm()
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data

        user = db.session.execute(
            select(User).filter_by(username=username)
        ).scalar()

        if user and user.validate_password(password):
            login_user(user)
            flash("Login success.")
            if form.remember_me.data:
                # 设置记住我功能
                login_user(user, remember=True)
            else:
                login_user(user, remember=False)
            return redirect(url_for("main.index"))

        flash("Invalid username or password.")
        return redirect(url_for("auth.login"))

    return render_template("login.html", form=form)


# 退出登录的路由
@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You have been logged out.")
    return redirect(url_for("main.index"))


# 发送邮箱验证码的路由
@auth_bp.route("/email/code", methods=["GET"])
def send_test_email():
    # 获取请求参数中的邮箱地址
    email = request.args.get("email")
    if not email:
        return jsonify(
            {"status": "fail", "message": "Email is required."}
        ), 400
    # 这里可以添加发送邮箱验证码的逻辑
    # 例如，使用 Flask-Mail 发送邮件
    # 生成验证码
    code = [random.choice("012345678901234567890123456789") for _ in range(6)]
    verification_code = "".join(code)
    message = Message(
        subject="Your Verification Code",
        recipients=[email],
        body=f"Your verification code is: {verification_code}",
    )
    try:
        mail.send(message)
    except Exception as e:
        return jsonify(
            {"status": "fail", "message": f"Failed to send email: {e!s}"}
        ), 500
    # 将验证码存储到数据库中（假设有一个 SignUpCode 模型）
    sign_up_code = SignUpCode(email=email, code=verification_code)
    db.session.add(sign_up_code)
    db.session.commit()
    return jsonify(
        {"status": "success", "message": f"Verification code sent to {email}."}
    )


# 注册新用户的路由
@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    form = SignUpForm()
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        email = form.email.data
        email_code = form.email_code.data
        # 检查用户名是否已存在
        existing_user = db.session.execute(
            select(User).filter_by(username=username)
        ).scalar()
        if existing_user:
            flash("Username already exists.")
            return redirect(url_for("auth.register"))
        # 检查邮箱验证码是否正确
        code_model = db.session.execute(
            select(SignUpCode).filter_by(email=email, code=email_code)
        ).scalar()
        if not code_model:
            flash("Invalid email or verification code.")
            return redirect(url_for("auth.register"))
        # 创建新用户
        if username:
            new_user = User(username=username)
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.flush()
            new_profile = Profile(user_id=new_user.id)
            new_profile.email = email
            new_user.profile = new_profile
            db.session.commit()
            flash("Registration successful. Please log in.")
            return redirect(url_for("auth.login"))

    return render_template("register.html", form=form)
