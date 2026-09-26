"""add isolated execution results

Revision ID: aa574da21a38
Revises: 3b7f2f4d9a10
Create Date: 2026-09-27 13:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "aa574da21a38"
down_revision = "3b7f2f4d9a10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_submissions_status", "submissions", type_="check")
    op.create_check_constraint(
        "ck_submissions_status",
        "submissions",
        "status IN ('pending', 'running', 'completed', 'failed', 'accepted', "
        "'wrong_answer', 'compilation_error', 'runtime_error', 'timeout', 'system_error')",
    )
    op.add_column("submissions", sa.Column("stdout", sa.Text(), nullable=True))
    op.add_column("submissions", sa.Column("stderr", sa.Text(), nullable=True))
    op.add_column("submissions", sa.Column("exit_code", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("submissions", "exit_code")
    op.drop_column("submissions", "stderr")
    op.drop_column("submissions", "stdout")
    op.drop_constraint("ck_submissions_status", "submissions", type_="check")
    op.create_check_constraint(
        "ck_submissions_status",
        "submissions",
        "status IN ('pending', 'running', 'accepted', 'wrong_answer', "
        "'compilation_error', 'runtime_error', 'timeout', 'system_error')",
    )
