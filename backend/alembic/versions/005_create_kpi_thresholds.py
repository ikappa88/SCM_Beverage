"""create kpi_thresholds table

Revision ID: 005
Revises: 004
Create Date: 2026-03-22
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "kpi_thresholds",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kpi_key", sa.String(50), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("warning_value", sa.Float(), nullable=False),
        sa.Column("danger_value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
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
        sa.UniqueConstraint("kpi_key"),
    )
    op.create_index("ix_kpi_thresholds_id", "kpi_thresholds", ["id"])

    # 初期データ
    op.bulk_insert(
        sa.table(
            "kpi_thresholds",
            sa.column("kpi_key", sa.String),
            sa.column("label", sa.String),
            sa.column("warning_value", sa.Float),
            sa.column("danger_value", sa.Float),
            sa.column("unit", sa.String),
            sa.column("description", sa.Text),
        ),
        [
            {
                "kpi_key": "stockout_rate",
                "label": "欠品率",
                "warning_value": 5.0,
                "danger_value": 10.0,
                "unit": "%",
                "description": "在庫が安全在庫を下回っている品目の割合",
            },
            {
                "kpi_key": "delivery_rate",
                "label": "配送達成率",
                "warning_value": 90.0,
                "danger_value": 80.0,
                "unit": "%",
                "description": "予定通りに配送が完了した割合",
            },
            {
                "kpi_key": "inventory_days",
                "label": "在庫回転日数",
                "warning_value": 30.0,
                "danger_value": 45.0,
                "unit": "日",
                "description": "現在の在庫が何日分の需要に相当するか",
            },
            {
                "kpi_key": "alert_count",
                "label": "アクティブアラート数",
                "warning_value": 5.0,
                "danger_value": 10.0,
                "unit": "件",
                "description": "現在発生中のアラートの件数",
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_kpi_thresholds_id", table_name="kpi_thresholds")
    op.drop_table("kpi_thresholds")
