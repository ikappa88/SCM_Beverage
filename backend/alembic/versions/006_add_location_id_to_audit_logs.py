"""add location_id to audit_logs

Revision ID: 006
Revises: 005
Create Date: 2026-03-29
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "audit_logs",
        sa.Column("location_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_audit_logs_location",
        "audit_logs",
        "locations",
        ["location_id"],
        ["id"],
    )
    op.create_index("ix_audit_logs_location_id", "audit_logs", ["location_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_location_id", table_name="audit_logs")
    op.drop_constraint("fk_audit_logs_location", "audit_logs", type_="foreignkey")
    op.drop_column("audit_logs", "location_id")
