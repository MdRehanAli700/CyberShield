"""Add provider identities and short-lived OAuth handoff codes."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_social_auth"
down_revision: Union[str, None] = "0004_email_verification"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "oauth_identities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "subject", name="uq_oauth_identity_provider_subject"),
    )
    op.create_index("ix_oauth_identities_id", "oauth_identities", ["id"])
    op.create_index("ix_oauth_identities_user_id", "oauth_identities", ["user_id"])
    op.create_table(
        "oauth_handoff_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_oauth_handoff_tokens_id", "oauth_handoff_tokens", ["id"])
    op.create_index("ix_oauth_handoff_tokens_user_id", "oauth_handoff_tokens", ["user_id"])
    op.create_index("ix_oauth_handoff_tokens_token_hash", "oauth_handoff_tokens", ["token_hash"], unique=True)
    op.create_index("ix_oauth_handoff_tokens_expires_at", "oauth_handoff_tokens", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_oauth_handoff_tokens_expires_at", table_name="oauth_handoff_tokens")
    op.drop_index("ix_oauth_handoff_tokens_token_hash", table_name="oauth_handoff_tokens")
    op.drop_index("ix_oauth_handoff_tokens_user_id", table_name="oauth_handoff_tokens")
    op.drop_index("ix_oauth_handoff_tokens_id", table_name="oauth_handoff_tokens")
    op.drop_table("oauth_handoff_tokens")
    op.drop_index("ix_oauth_identities_user_id", table_name="oauth_identities")
    op.drop_index("ix_oauth_identities_id", table_name="oauth_identities")
    op.drop_table("oauth_identities")
