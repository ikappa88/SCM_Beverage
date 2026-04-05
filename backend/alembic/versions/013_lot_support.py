"""add lot_number to inventories, remove null-expiry records

Revision ID: 013
Revises: 012
Create Date: 2026-04-05
"""

from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. expiry_date が NULL の在庫レコードを削除（ロット別管理移行）
    op.execute("DELETE FROM inventories WHERE expiry_date IS NULL")

    # 2. lot_number 列を追加（任意のロットラベル用）
    op.add_column(
        "inventories",
        sa.Column("lot_number", sa.String(50), nullable=True, comment="ロット番号（任意）"),
    )


def downgrade() -> None:
    op.drop_column("inventories", "lot_number")
    # 削除したレコードは復元できないため downgrade は部分的
