"""add per-test submission evaluation results

Revision ID: c1d9f88a0b61
Revises: aa574da21a38
Create Date: 2026-09-27 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "c1d9f88a0b61"
down_revision = "aa574da21a38"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_submissions_status", "submissions", type_="check")
    op.create_check_constraint(
        "ck_submissions_status",
        "submissions",
        "status IN ('pending', 'running', 'completed', 'failed', 'accepted', "
        "'wrong_answer', 'compilation_error', 'runtime_error', 'timeout', "
        "'time_limit_exceeded', 'output_limit_exceeded', 'system_error')",
    )
    op.create_table(
        "submission_test_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("submission_id", sa.Uuid(), nullable=False),
        sa.Column("test_case_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_hidden", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("execution_time_ms", sa.Integer(), nullable=True),
        sa.Column("stdout", sa.Text(), nullable=True),
        sa.Column("stderr", sa.Text(), nullable=True),
        sa.Column("exit_code", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "status IN ('accepted', 'wrong_answer', 'compilation_error', 'runtime_error', "
            "'time_limit_exceeded', 'output_limit_exceeded', 'system_error')",
            name="ck_submission_test_results_status",
        ),
        sa.CheckConstraint("position >= 0", name="ck_submission_test_results_position_nonnegative"),
        sa.CheckConstraint(
            "execution_time_ms IS NULL OR execution_time_ms >= 0",
            name="ck_submission_test_results_execution_time_nonnegative",
        ),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["test_case_id"], ["problem_test_cases.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("submission_id", "test_case_id", name="uq_submission_test_result_case"),
    )
    op.create_index(
        "ix_submission_test_results_submission_id",
        "submission_test_results",
        ["submission_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_submission_test_results_submission_id", table_name="submission_test_results")
    op.drop_table("submission_test_results")
    op.execute(
        "UPDATE submissions SET status = 'timeout' WHERE status = 'time_limit_exceeded'"
    )
    op.execute(
        "UPDATE submissions SET status = 'failed' WHERE status = 'output_limit_exceeded'"
    )
    op.drop_constraint("ck_submissions_status", "submissions", type_="check")
    op.create_check_constraint(
        "ck_submissions_status",
        "submissions",
        "status IN ('pending', 'running', 'completed', 'failed', 'accepted', "
        "'wrong_answer', 'compilation_error', 'runtime_error', 'timeout', 'system_error')",
    )
