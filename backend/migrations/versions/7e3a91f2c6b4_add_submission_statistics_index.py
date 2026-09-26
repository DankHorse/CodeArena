"""add index for submission aggregate queries

Revision ID: 7e3a91f2c6b4
Revises: c1d9f88a0b61
Create Date: 2026-09-27 00:00:00.000000
"""

from alembic import op


revision = "7e3a91f2c6b4"
down_revision = "c1d9f88a0b61"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_submissions_status_problem_user",
        "submissions",
        ["status", "problem_id", "user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_submissions_status_problem_user", table_name="submissions")
