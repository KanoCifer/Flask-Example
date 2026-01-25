from flask_wtf import FlaskForm
from wtforms import BooleanField, StringField, SubmitField
from wtforms.validators import DataRequired, Length


class BookForm(FlaskForm):
    title = StringField(
        "Title",
        description="请输入书名",
        validators=[
            DataRequired(message="书名不能为空"),
            Length(min=1, max=100, message="书名长度必须在1-100之间"),
        ],
    )
    author = StringField(
        "Author",
        description="请输入作者",
        validators=[
            DataRequired(message="作者不能为空"),
            Length(min=1, max=60, message="作者长度必须在1-60之间"),
        ],
    )
    submit = SubmitField("Submit")


class QLoginForm(FlaskForm):
    username = StringField(
        "Username",
        description="请输入用户名",
        validators=[DataRequired(message="用户名不能为空")],
    )
    password = StringField(
        "Password",
        description="请输入密码",
        validators=[DataRequired(message="密码不能为空")],
    )
    remember_me = BooleanField("Remember Me")
    submit = SubmitField("Login")


class SettingsForm(FlaskForm):
    name = StringField(
        "Name",
        description="请输入你的名称/昵称",
        validators=[
            DataRequired(message="名称不能为空"),
            Length(min=1, max=20, message="名称长度必须在1-20之间"),
        ],
    )

    username = StringField(
        "Username",
        description="请输入你的用户名/登陆名",
        validators=[
            DataRequired(message="用户名不能为空"),
            Length(min=1, max=20, message="用户名长度必须在1-20之间"),
        ],
    )

    password = StringField("Password", description="留空表示不修改密码")

    submit = SubmitField("Save")


# 注册表单
class SignUpForm(FlaskForm):
    username = StringField(
        "Username",
        description="请输入用户名",
        validators=[DataRequired(message="用户名不能为空")],
    )
    email = StringField(
        "Email",
        description="请输入邮箱",
        validators=[DataRequired(message="邮箱不能为空")],
    )
    email_code = StringField(
        "Email Code",
        description="请输入邮箱验证码",
        validators=[DataRequired(message="邮箱验证码不能为空")],
    )
    password = StringField(
        "Password",
        description="请输入密码",
        validators=[DataRequired(message="密码不能为空")],
    )
    submit = SubmitField("Sign Up")
