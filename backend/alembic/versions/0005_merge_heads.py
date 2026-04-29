"""Merge divergent migration heads into single head

Revision ID: 0005_merge_heads
Revises: 0004_add_analytics_columns, eea25a982c2e
Create Date: 2026-04-29
"""

from alembic import op

revision = "0005_merge_heads"
down_revision = ("0004_add_analytics_columns", "eea25a982c2e")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
