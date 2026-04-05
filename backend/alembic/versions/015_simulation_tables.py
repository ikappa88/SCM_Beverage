"""add simulation tables (clock, events, parameters)

Revision ID: 015
Revises: 014
Create Date: 2026-04-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- simulation_clock (single-row global virtual clock) ---
    op.create_table(
        "simulation_clock",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "virtual_time",
            sa.DateTime(timezone=False),
            nullable=False,
            comment="現在の仮想時刻",
        ),
        sa.Column(
            "initial_time",
            sa.DateTime(timezone=False),
            nullable=False,
            comment="リセット先の初期時刻",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            comment="最終更新日時（実時間）",
        ),
    )
    # Seed the single row with a default start date (2026-04-01 AM 09:00)
    op.execute(
        "INSERT INTO simulation_clock (id, virtual_time, initial_time, updated_at) "
        "VALUES (1, '2026-04-01 09:00:00', '2026-04-01 09:00:00', NOW())"
    )

    # --- simulation_events (event log per half-day advance) ---
    op.create_table(
        "simulation_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "virtual_time",
            sa.DateTime(timezone=False),
            nullable=False,
            index=True,
            comment="イベント発生時点の仮想時刻",
        ),
        sa.Column(
            "half_day",
            sa.String(2),
            nullable=False,
            comment="AM or PM",
        ),
        sa.Column(
            "event_type",
            sa.String(50),
            nullable=False,
            index=True,
            comment="イベント種別",
        ),
        sa.Column(
            "payload",
            JSONB,
            nullable=False,
            comment="イベント詳細（拠点・SKU・数量など）",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
            comment="実時間での記録日時",
        ),
    )

    # --- simulation_parameters (key-value coefficient store) ---
    op.create_table(
        "simulation_parameters",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "category",
            sa.String(50),
            nullable=False,
            index=True,
            comment="demand / delivery / stock / clock",
        ),
        sa.Column(
            "key",
            sa.String(100),
            nullable=False,
            comment="パラメータ名",
        ),
        sa.Column(
            "value",
            JSONB,
            nullable=False,
            comment="値（数値・配列・オブジェクト）",
        ),
        sa.Column("description", sa.Text(), nullable=True, comment="説明文"),
        sa.Column(
            "updated_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            comment="最終更新ユーザー",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
            comment="最終更新日時",
        ),
        sa.UniqueConstraint("category", "key", name="uq_sim_param_category_key"),
    )


def downgrade() -> None:
    op.drop_table("simulation_parameters")
    op.drop_table("simulation_events")
    op.drop_table("simulation_clock")
