"""add scoring and classification fields

Revision ID: f4d2c1b7a9e2
Revises: eea25a982c2e
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4d2c1b7a9e2"
down_revision: Union[str, Sequence[str], None] = "eea25a982c2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "leak_records",
        sa.Column("risk_score", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "leak_records",
        sa.Column("classification", sa.String(length=32), server_default=sa.text("'irrelevant'"), nullable=False),
    )
    op.create_index("ix_leak_records_risk_score", "leak_records", ["risk_score"], unique=False)
    op.create_index("ix_leak_records_classification", "leak_records", ["classification"], unique=False)

    op.add_column(
        "analysis_result",
        sa.Column("matched_companies", sa.JSON(), server_default=sa.text("'[]'"), nullable=False),
    )
    op.add_column(
        "analysis_result",
        sa.Column("terminology_hits", sa.JSON(), server_default=sa.text("'[]'"), nullable=False),
    )
    op.add_column(
        "analysis_result",
        sa.Column("score_contributors", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
    )
    op.add_column(
        "analysis_result",
        sa.Column("classification_rule", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_result", "classification_rule")
    op.drop_column("analysis_result", "score_contributors")
    op.drop_column("analysis_result", "terminology_hits")
    op.drop_column("analysis_result", "matched_companies")

    op.drop_index("ix_leak_records_classification", table_name="leak_records")
    op.drop_index("ix_leak_records_risk_score", table_name="leak_records")
    op.drop_column("leak_records", "classification")
    op.drop_column("leak_records", "risk_score")
