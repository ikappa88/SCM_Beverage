"""add linked_alert_id to orders

Revision ID: 017
Revises: 016
Create Date: 2026-04-06
"""

from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "linked_alert_id",
            sa.Integer(),
            sa.ForeignKey("alerts.id", ondelete="SET NULL"),
            nullable=True,
            comment="対応元アラートID（P1-005: アラートと発注の紐付け）",
        ),
    )


def downgrade() -> None:
    op.drop_column("orders", "linked_alert_id")
