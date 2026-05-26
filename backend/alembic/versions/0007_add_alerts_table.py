"""add alerts table

Revision ID: 0007_add_alerts_table
Revises: 0006_add_review_fields
Create Date: 2026-05-26
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_add_alerts_table"
down_revision = "0006_add_review_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("leak_record_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("is_reviewed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["leak_record_id"], ["leak_records.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alerts_created_at", "alerts", ["created_at"], unique=False)
    op.create_index("ix_alerts_company_id", "alerts", ["company_id"], unique=False)
    op.create_index("ix_alerts_is_reviewed", "alerts", ["is_reviewed"], unique=False)
    op.create_index("ix_alerts_severity", "alerts", ["severity"], unique=False)


def downgrade():
    op.drop_index("ix_alerts_severity", table_name="alerts")
    op.drop_index("ix_alerts_is_reviewed", table_name="alerts")
    op.drop_index("ix_alerts_company_id", table_name="alerts")
    op.drop_index("ix_alerts_created_at", table_name="alerts")
    op.drop_table("alerts")
