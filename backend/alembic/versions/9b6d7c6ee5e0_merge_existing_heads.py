"""merge existing heads

Revision ID: 9b6d7c6ee5e0
Revises: 0005_merge_heads, f4d2c1b7a9e2
Create Date: 2026-05-20
"""

from alembic import op


revision = "9b6d7c6ee5e0"
down_revision = ("0005_merge_heads", "f4d2c1b7a9e2")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
