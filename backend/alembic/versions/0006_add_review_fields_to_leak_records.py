"""add review fields to leak_records

Revision ID: 0006_add_review_fields
Revises: 9b6d7c6ee5e0
Create Date: 2026-05-20
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_add_review_fields"
down_revision = "9b6d7c6ee5e0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "leak_records",
        sa.Column("is_reviewed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "leak_records",
        sa.Column("is_false_positive", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "leak_records",
        sa.Column("review_notes", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("leak_records", "review_notes")
    op.drop_column("leak_records", "is_false_positive")
    op.drop_column("leak_records", "is_reviewed")
