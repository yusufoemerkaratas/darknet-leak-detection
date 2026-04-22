"""add raw_content_text, is_analyzed, detected_links to leak_records

Revision ID: 0003_add_content_fields
Revises: 0002_leak_records_schema
Create Date: 2026-04-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_add_content_fields"
down_revision = "0002_leak_records_schema"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "leak_records",
        sa.Column("raw_content_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "leak_records",
        sa.Column("is_analyzed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "leak_records",
        sa.Column("detected_links", postgresql.JSONB(), nullable=True),
    )


def downgrade():
    op.drop_column("leak_records", "detected_links")
    op.drop_column("leak_records", "is_analyzed")
    op.drop_column("leak_records", "raw_content_text")
