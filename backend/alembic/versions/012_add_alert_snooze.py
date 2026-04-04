"""add snooze fields to alerts

Revision ID: 012
Revises: 011
Create Date: 2026-04-04
"""

from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "alerts",
        sa.Column("snoozed_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "alerts",
        sa.Column("snooze_reason", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("alerts", "snooze_reason")
    op.drop_column("alerts", "snoozed_until")
