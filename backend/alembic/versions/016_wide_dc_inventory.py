"""add wide_dc_inventory table

Revision ID: 016
Revises: 015
Create Date: 2026-04-06
"""

from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wide_dc_inventory",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "location_id",
            sa.Integer(),
            sa.ForeignKey("locations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
            comment="広域DC拠点ID（location_type=dc のみ）",
        ),
        sa.Column(
            "product_id",
            sa.Integer(),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
            comment="商品ID",
        ),
        sa.Column(
            "quantity",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="現在庫数",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
            comment="最終更新日時",
        ),
        sa.UniqueConstraint("location_id", "product_id", name="uq_wide_dc_inv_loc_prod"),
    )


def downgrade() -> None:
    op.drop_table("wide_dc_inventory")
