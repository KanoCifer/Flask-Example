"""make_gallery_image_mime_type_nullable

Revision ID: 97d4af872c55
Revises: 62b7a4683d13
Create Date: 2026-07-31 16:06:11.237510

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '97d4af872c55'
down_revision: Union[str, Sequence[str], None] = '62b7a4683d13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make mime_type nullable so failed images can store NULL."""
    op.alter_column(
        "gallery_image",
        "mime_type",
        existing_type=sa.String(length=50),
        nullable=True,
        existing_server_default=sa.text("'image/jpeg'::character varying"),
    )


def downgrade() -> None:
    """Revert: fill NULL back to 'image/jpeg', then restore NOT NULL."""
    op.execute(
        "UPDATE gallery_image SET mime_type = 'image/jpeg' WHERE mime_type IS NULL"
    )
    op.alter_column(
        "gallery_image",
        "mime_type",
        existing_type=sa.String(length=50),
        nullable=False,
        existing_server_default=sa.text("'image/jpeg'::character varying"),
    )
