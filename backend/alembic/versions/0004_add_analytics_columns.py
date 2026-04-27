"""add email_count and estimated_size_mb to leak_records

Revision ID: 0004_add_analytics_columns
Revises: 0003_add_content_fields
Create Date: 2026-04-15
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_add_analytics_columns"
down_revision = "0003_add_content_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "leak_records",
        sa.Column("email_count", sa.Integer(), nullable=True),
    )
    op.add_column(
        "leak_records",
        sa.Column("estimated_size_mb", sa.Numeric(precision=12, scale=2), nullable=True),
    )


def downgrade():
    op.drop_column("leak_records", "estimated_size_mb")
    op.drop_column("leak_records", "email_count")
