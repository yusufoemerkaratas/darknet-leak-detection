"""add leak records schema

Revision ID: 0002_leak_records_schema
Revises: 0001_init
Create Date: 2026-04-04
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_leak_records_schema"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("companies", "name", existing_type=sa.String(), nullable=False)
    op.alter_column("sources", "name", existing_type=sa.String(), nullable=False)
    op.alter_column("sources", "url", existing_type=sa.String(), nullable=False)

    op.create_table(
        "leak_records",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("raw_url", sa.String(length=512), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
    )

    op.create_index("ix_leak_records_id", "leak_records", ["id"], unique=False)
    op.create_index("ix_leak_records_content_hash", "leak_records", ["content_hash"], unique=True)
    op.create_index("ix_leak_records_published_at", "leak_records", ["published_at"], unique=False)
    op.create_index("ix_leak_records_source_id", "leak_records", ["source_id"], unique=False)
    op.create_index("ix_leak_records_company_id", "leak_records", ["company_id"], unique=False)
    op.create_index(
        "ix_leak_records_published_collected",
        "leak_records",
        ["published_at", "collected_at"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_leak_records_published_collected", table_name="leak_records")
    op.drop_index("ix_leak_records_company_id", table_name="leak_records")
    op.drop_index("ix_leak_records_source_id", table_name="leak_records")
    op.drop_index("ix_leak_records_published_at", table_name="leak_records")
    op.drop_index("ix_leak_records_content_hash", table_name="leak_records")
    op.drop_index("ix_leak_records_id", table_name="leak_records")
    op.drop_table("leak_records")

    op.alter_column("sources", "url", existing_type=sa.String(), nullable=True)
    op.alter_column("sources", "name", existing_type=sa.String(), nullable=True)
    op.alter_column("companies", "name", existing_type=sa.String(), nullable=True)
