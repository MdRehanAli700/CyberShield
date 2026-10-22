"""Persist the selected trusted payee identifier type."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_payee_identifier_type"
down_revision: Union[str, None] = "0005_social_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "trusted_payees",
        sa.Column("identifier_type", sa.String(length=20), nullable=False, server_default="Contact"),
    )


def downgrade() -> None:
    op.drop_column("trusted_payees", "identifier_type")
