"""Persist basic profile, preferences and trusted-payee metadata."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_profile_prefs_payee"
down_revision: Union[str, None] = "0002_password_reset"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("phone_number", sa.String(length=40), nullable=True))
    op.add_column("users", sa.Column("theme", sa.String(length=12), nullable=False, server_default="dark"))
    op.add_column("users", sa.Column("language", sa.String(length=12), nullable=False, server_default="en"))
    op.add_column("users", sa.Column("currency", sa.String(length=8), nullable=False, server_default="INR"))
    op.add_column("trusted_payees", sa.Column("category", sa.String(length=20), nullable=False, server_default="Personal"))
    op.add_column("trusted_payees", sa.Column("notes", sa.String(length=160), nullable=True))


def downgrade() -> None:
    op.drop_column("trusted_payees", "notes")
    op.drop_column("trusted_payees", "category")
    op.drop_column("users", "currency")
    op.drop_column("users", "language")
    op.drop_column("users", "theme")
    op.drop_column("users", "phone_number")
    op.drop_column("users", "display_name")
