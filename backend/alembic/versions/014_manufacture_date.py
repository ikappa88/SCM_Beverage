"""replace lot_number with manufacture_date as lot identifier

Revision ID: 014
Revises: 013
Create Date: 2026-04-05
"""

from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # lot_number を削除し、manufacture_date (Date) を追加
    op.drop_column("inventories", "lot_number")
    op.add_column(
        "inventories",
        sa.Column("manufacture_date", sa.Date(), nullable=True, comment="製造日（ロット識別キー）"),
    )
    # 既存レコードの manufacture_date を expiry_date - 180日で仮設定（nullのまま残さない）
    op.execute("""
        UPDATE inventories
        SET manufacture_date = expiry_date - INTERVAL '180 days'
        WHERE expiry_date IS NOT NULL AND manufacture_date IS NULL
    """)


def downgrade() -> None:
    op.drop_column("inventories", "manufacture_date")
    op.add_column(
        "inventories",
        sa.Column("lot_number", sa.String(50), nullable=True, comment="ロット番号（任意）"),
    )
