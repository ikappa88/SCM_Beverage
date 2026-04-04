"""add expiry_date to inventories, extend alert enums, add alert_settings

Revision ID: 011
Revises: 010
Create Date: 2026-04-01
"""

from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. inventories に expiry_date カラムを追加
    op.add_column("inventories", sa.Column("expiry_date", sa.Date(), nullable=True))

    # 2. AlertType enum に新しい値を追加（PostgreSQL の ALTER TYPE）
    op.execute("ALTER TYPE alerttype ADD VALUE IF NOT EXISTS 'expiry_expired'")
    op.execute("ALTER TYPE alerttype ADD VALUE IF NOT EXISTS 'expiry_near'")

    # 3. AlertSeverity enum に info を追加
    op.execute("ALTER TYPE alertseverity ADD VALUE IF NOT EXISTS 'info'")

    # 4. alert_settings テーブルを作成
    op.create_table(
        "alert_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("setting_key", sa.String(100), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
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
    )
    op.create_index("ix_alert_settings_id", "alert_settings", ["id"])
    op.create_index(
        "ix_alert_settings_setting_key", "alert_settings", ["setting_key"], unique=True
    )

    # 5. デフォルトしきい値データを投入
    op.execute("""
        INSERT INTO alert_settings (setting_key, label, value, description)
        VALUES
          ('expiry_near_days',   '賞味期限警告（日前）', 7,
           '賞味期限の何日前から「警告」アラートを出すか'),
          ('expiry_danger_days', '賞味期限緊急（日前）', 3,
           '賞味期限の何日前から「緊急」アラートに昇格させるか')
        ON CONFLICT (setting_key) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_index("ix_alert_settings_setting_key", table_name="alert_settings")
    op.drop_index("ix_alert_settings_id", table_name="alert_settings")
    op.drop_table("alert_settings")
    op.drop_column("inventories", "expiry_date")
    # PostgreSQL では enum 値の削除は非サポートのため、enum 自体はそのままにする
