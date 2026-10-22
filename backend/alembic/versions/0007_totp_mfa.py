"""Add TOTP-based multi-factor authentication."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007_totp_mfa"
down_revision: Union[str, None] = "0006_payee_identifier_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_secret_encrypted", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("totp_pending_secret_encrypted", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("totp_setup_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("totp_enabled", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("users", sa.Column("totp_last_used_step", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("totp_recovery_code_hashes", sa.Text(), nullable=True))
    op.create_table(
        "mfa_login_challenges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_mfa_login_challenges_id", "mfa_login_challenges", ["id"])
    op.create_index("ix_mfa_login_challenges_user_id", "mfa_login_challenges", ["user_id"])
    op.create_index("ix_mfa_login_challenges_token_hash", "mfa_login_challenges", ["token_hash"])
    op.create_index("ix_mfa_login_challenges_expires_at", "mfa_login_challenges", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_mfa_login_challenges_expires_at", table_name="mfa_login_challenges")
    op.drop_index("ix_mfa_login_challenges_token_hash", table_name="mfa_login_challenges")
    op.drop_index("ix_mfa_login_challenges_user_id", table_name="mfa_login_challenges")
    op.drop_index("ix_mfa_login_challenges_id", table_name="mfa_login_challenges")
    op.drop_table("mfa_login_challenges")
    op.drop_column("users", "totp_recovery_code_hashes")
    op.drop_column("users", "totp_last_used_step")
    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_setup_expires_at")
    op.drop_column("users", "totp_pending_secret_encrypted")
    op.drop_column("users", "totp_secret_encrypted")
