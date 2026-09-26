"""create problems and problem test cases

Revision ID: 8e42c7a91d60
Revises: 4023fa5aa444
Create Date: 2026-09-27 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "8e42c7a91d60"
down_revision = "4023fa5aa444"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "problems",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("difficulty", sa.String(length=16), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("constraints", sa.Text(), nullable=True),
        sa.Column("input_description", sa.Text(), nullable=False),
        sa.Column("output_description", sa.Text(), nullable=False),
        sa.Column("starter_code", sa.JSON(), nullable=False),
        sa.Column("supported_languages", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "difficulty IN ('easy', 'medium', 'hard')", name="ck_problems_difficulty"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_problems_slug"),
    )
    op.create_table(
        "problem_test_cases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("problem_id", sa.Uuid(), nullable=False),
        sa.Column("input_data", sa.Text(), nullable=False),
        sa.Column("expected_output", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_hidden", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("time_limit_ms", sa.Integer(), nullable=True),
        sa.Column("memory_limit_mb", sa.Integer(), nullable=True),
        sa.CheckConstraint("position >= 0", name="ck_problem_test_cases_position_nonnegative"),
        sa.CheckConstraint(
            "time_limit_ms IS NULL OR time_limit_ms > 0",
            name="ck_problem_test_cases_time_limit_positive",
        ),
        sa.CheckConstraint(
            "memory_limit_mb IS NULL OR memory_limit_mb > 0",
            name="ck_problem_test_cases_memory_limit_positive",
        ),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_problem_test_cases_problem_id", "problem_test_cases", ["problem_id"])


def downgrade() -> None:
    op.drop_index("ix_problem_test_cases_problem_id", table_name="problem_test_cases")
    op.drop_table("problem_test_cases")
    op.drop_table("problems")
