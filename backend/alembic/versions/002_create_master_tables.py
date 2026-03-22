"""create master tables

Revision ID: 002
Revises: 001
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 拠点マスタ
    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "location_type",
            sa.Enum("factory", "dc", "tc", "retail", name="locationtype"),
            nullable=False,
        ),
        sa.Column("area", sa.String(50), nullable=True),
        sa.Column("address", sa.String(255), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_locations_id", "locations", ["id"])
    op.create_index("ix_locations_code", "locations", ["code"], unique=True)

    # 商品マスタ
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("unit_size", sa.String(20), nullable=True),
        sa.Column("min_order_qty", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_products_id", "products", ["id"])
    op.create_index("ix_products_code", "products", ["code"], unique=True)

    # 輸送ルートマスタ
    op.create_table(
        "routes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("origin_id", sa.Integer(), nullable=False),
        sa.Column("destination_id", sa.Integer(), nullable=False),
        sa.Column("lead_time_days", sa.Integer(), nullable=False),
        sa.Column("cost_per_unit", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["origin_id"], ["locations.id"]),
        sa.ForeignKeyConstraint(["destination_id"], ["locations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_routes_id", "routes", ["id"])
    op.create_index("ix_routes_code", "routes", ["code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_routes_code", table_name="routes")
    op.drop_index("ix_routes_id", table_name="routes")
    op.drop_table("routes")
    op.drop_index("ix_products_code", table_name="products")
    op.drop_index("ix_products_id", table_name="products")
    op.drop_table("products")
    op.drop_index("ix_locations_code", table_name="locations")
    op.drop_index("ix_locations_id", table_name="locations")
    op.drop_table("locations")
    op.execute("DROP TYPE IF EXISTS locationtype")
