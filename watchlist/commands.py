import click
from sqlalchemy import select

from watchlist.extensions import db
from watchlist.models import Book, User


@click.command()
def forge():
    db.drop_all()
    db.create_all()
    name = "Grey Li"
    books = [
        {
            "title": "Flask Web开发实战：入门、进阶与原理解析",
            "author": "李辉",
        }
    ]
    user = User()
    user.name = name
    user.username = "admin"
    user.set_password("helloflask")
    db.session.add(user)
    for item in books:
        book = Book()
        book.title = item["title"]
        book.author = item["author"]
        db.session.add(book)

    db.session.commit()
    click.echo("Done.")


@click.command()
@click.option("--username", prompt=True, help="The username used to login.")
@click.option(
    "--password",
    prompt=True,
    hide_input=True,
    confirmation_prompt=True,
    help="The password used to login.",
)
def admin(username, password):
    db.create_all()

    user = db.session.execute(select(User)).scalar()
    if user is not None:
        click.echo("Updating user...")
        user.username = username
        user.set_password(password)
    else:
        click.echo("Creating user...")
        user = User()
        user.username = username
        user.name = "Admin"
        user.set_password(password)
        db.session.add(user)

    db.session.commit()
    click.echo("Done.")
