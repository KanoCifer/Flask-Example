"""add more metadata

Revision ID: 62b7a4683d13
Revises: 6a8b2c4d1e3f
Create Date: 2026-07-31 14:45:22.782029

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '62b7a4683d13'
down_revision: Union[str, Sequence[str], None] = '6a8b2c4d1e3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    No-op: this squash migration originally used incorrect plural table/index
    names (e.g. ``passkey_credentials`` vs. the model's ``passkey_credential``),
    making ``DROP INDEX`` fail on production. Disabled in place rather than
    deleting the file, because ``97d4af872c55``'s ``down_revision`` is already
    pinned to this revision and has been pushed to the remote.
    """
    pass


def downgrade() -> None:
    """Downgrade schema.

    No-op counterpart of :func:`upgrade`. See that function for the rationale.
    """
    pass
