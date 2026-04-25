"""add crawl jobs table with indexes

Revision ID: eea25a982c2e
Revises: b254661f49f1
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "eea25a982c2e"
down_revision: Union[str, Sequence[str], None] = "b254661f49f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "crawl_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("total_records", sa.Integer(), nullable=True),
        sa.Column("inserted_records", sa.Integer(), nullable=True),
        sa.Column("duplicate_records", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_crawl_jobs_id", "crawl_jobs", ["id"], unique=False)
    op.create_index("ix_crawl_jobs_source_id", "crawl_jobs", ["source_id"], unique=False)
    op.create_index("ix_crawl_jobs_status", "crawl_jobs", ["status"], unique=False)
    op.create_index("ix_crawl_jobs_started_at", "crawl_jobs", ["started_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_crawl_jobs_started_at", table_name="crawl_jobs")
    op.drop_index("ix_crawl_jobs_status", table_name="crawl_jobs")
    op.drop_index("ix_crawl_jobs_source_id", table_name="crawl_jobs")
    op.drop_index("ix_crawl_jobs_id", table_name="crawl_jobs")
    op.drop_table("crawl_jobs")