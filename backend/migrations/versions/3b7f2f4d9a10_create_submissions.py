"""create submissions

Revision ID: 3b7f2f4d9a10
Revises: 8e42c7a91d60
Create Date: 2026-09-27 12:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "3b7f2f4d9a10"
down_revision = "8e42c7a91d60"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "submissions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("problem_id", sa.Uuid(), nullable=False),
        sa.Column("language", sa.String(length=32), nullable=False),
        sa.Column("source_code", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=24), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("execution_time_ms", sa.Integer(), nullable=True),
        sa.Column("memory_usage_kb", sa.Integer(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending', 'running', 'accepted', 'wrong_answer', "
            "'compilation_error', 'runtime_error', 'timeout', 'system_error')",
            name="ck_submissions_status",
        ),
        sa.CheckConstraint(
            "execution_time_ms IS NULL OR execution_time_ms >= 0",
            name="ck_submissions_execution_time_nonnegative",
        ),
        sa.CheckConstraint(
            "memory_usage_kb IS NULL OR memory_usage_kb >= 0",
            name="ck_submissions_memory_usage_nonnegative",
        ),
        sa.CheckConstraint("score IS NULL OR (score >= 0 AND score <= 100)", name="ck_submissions_score_range"),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_submissions_problem_id", "submissions", ["problem_id"])
    op.create_index("ix_submissions_user_id", "submissions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_submissions_user_id", table_name="submissions")
    op.drop_index("ix_submissions_problem_id", table_name="submissions")
    op.drop_table("submissions")
