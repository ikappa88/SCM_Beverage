"""create scenarios table

Revision ID: 010
Revises: 009
Create Date: 2026-03-30
"""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scenarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("demand_factor", sa.Numeric(4, 2), nullable=False, server_default="1.00"),
        sa.Column("cost_factor", sa.Numeric(4, 2), nullable=False, server_default="1.00"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
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
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scenarios_id", "scenarios", ["id"])
    op.create_index("ix_scenarios_code", "scenarios", ["code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_scenarios_code", table_name="scenarios")
    op.drop_index("ix_scenarios_id", table_name="scenarios")
    op.drop_table("scenarios")
