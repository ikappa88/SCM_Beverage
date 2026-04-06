"""add awaiting_approval status and rejection_reason to orders

Revision ID: 019
Revises: 018
Create Date: 2026-04-06
"""

from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL では ALTER TYPE で新しい enum 値を追加する
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'awaiting_approval' BEFORE 'confirmed'")

    # 却下理由カラムを追加
    op.add_column(
        "orders",
        sa.Column("rejection_reason", sa.Text(), nullable=True, comment="却下理由（管理者が記入）"),
    )


def downgrade() -> None:
    op.drop_column("orders", "rejection_reason")
    # PostgreSQL では enum 値の削除は非サポートのため、downgrade では対応しない
