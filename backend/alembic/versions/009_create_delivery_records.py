"""create delivery_records table

Revision ID: 009
Revises: 008
Create Date: 2026-03-29
"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "delivery_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("delivery_code", sa.String(20), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("route_id", sa.Integer(), nullable=True),
        sa.Column("from_location_id", sa.Integer(), nullable=False),
        sa.Column("to_location_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "scheduled", "departed", "in_transit", "arrived", "delayed", "cancelled",
                name="deliverystatus",
            ),
            nullable=False,
            server_default="scheduled",
        ),
        sa.Column("scheduled_departure_date", sa.Date(), nullable=False),
        sa.Column("actual_departure_date", sa.Date(), nullable=True),
        sa.Column("expected_arrival_date", sa.Date(), nullable=False),
        sa.Column("actual_arrival_date", sa.Date(), nullable=True),
        sa.Column("delay_reason", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["route_id"], ["routes.id"]),
        sa.ForeignKeyConstraint(["from_location_id"], ["locations.id"]),
        sa.ForeignKeyConstraint(["to_location_id"], ["locations.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("delivery_code"),
    )
    op.create_index("ix_delivery_records_id", "delivery_records", ["id"])
    op.create_index("ix_delivery_records_from_location", "delivery_records", ["from_location_id"])
    op.create_index("ix_delivery_records_to_location", "delivery_records", ["to_location_id"])
    op.create_index("ix_delivery_records_status", "delivery_records", ["status"])
    op.create_index("ix_delivery_records_expected_arrival", "delivery_records", ["expected_arrival_date"])


def downgrade() -> None:
    op.drop_index("ix_delivery_records_expected_arrival", table_name="delivery_records")
    op.drop_index("ix_delivery_records_status", table_name="delivery_records")
    op.drop_index("ix_delivery_records_to_location", table_name="delivery_records")
    op.drop_index("ix_delivery_records_from_location", table_name="delivery_records")
    op.drop_index("ix_delivery_records_id", table_name="delivery_records")
    op.drop_table("delivery_records")
    op.execute("DROP TYPE IF EXISTS deliverystatus")
