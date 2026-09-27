from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.judging import (
    EvaluationDraftRequest,
    EvaluationEnvelope,
    EvaluationResponse,
    JudgeAssignmentDetailResponse,
    JudgeAssignmentListResponse,
    JudgeAssignmentResponse,
    JudgeEventCreate,
    JudgeEventResponse,
    JudgeProjectAssignmentCreate,
    JudgingProgressResponse,
    JudgingRecalculationResponse,
    JudgingResultsResponse,
    OwnJudgeScoresResponse,
    RubricCreate,
    RubricListResponse,
    RubricResponse,
)
from app.services.judging import (
    activate_rubric,
    assign_judge_to_event,
    create_project_assignment,
    create_rubric,
    export_results_csv,
    get_event_rubric,
    get_judge_assignment,
    get_own_evaluation,
    judging_progress,
    latest_results,
    list_judge_assignments,
    list_own_judge_scores,
    list_organizer_assignments,
    list_rubrics,
    recalculate_results,
    save_evaluation_draft,
    submit_evaluation,
)

router = APIRouter()


@router.get(
    "/judging/scores",
    response_model=OwnJudgeScoresResponse,
    summary="List the current judge's own scores",
    description="Judge-only. The optional judge query parameter is deliberately rejected; scores are never selectable by another judge's identity.",
)
def own_scores(
    judge: str | None = None,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_own_judge_scores(db, actor, judge)


@router.post(
    "/events/{event_id}/rubrics",
    response_model=RubricResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a draft judging rubric version",
    description="Organizer-only. Criteria weights must total exactly 100. Rubric versions are immutable after activation.",
)
def rubric_create(
    event_id: UUID,
    request: RubricCreate,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_rubric(db, event_id, request, actor)


@router.get(
    "/events/{event_id}/rubrics",
    response_model=RubricListResponse,
    summary="List rubric versions for an event",
)
def rubric_index(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"items": list_rubrics(db, event_id, actor)}


@router.get(
    "/events/{event_id}/rubric",
    response_model=RubricResponse,
    summary="Get the active rubric",
    description="Available to the event organizer and active event judges; participants are denied.",
)
def active_rubric(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_event_rubric(db, event_id, actor)


@router.post(
    "/events/{event_id}/rubrics/{rubric_id}/activate",
    response_model=RubricResponse,
    summary="Activate a rubric version",
    description="Organizer-only. Activation is rejected after project assignments exist.",
)
def rubric_activate(
    event_id: UUID,
    rubric_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return activate_rubric(db, event_id, rubric_id, actor)


@router.post(
    "/events/{event_id}/judges",
    response_model=JudgeEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign a participant account as an event judge",
)
def judge_assign(
    event_id: UUID,
    request: JudgeEventCreate,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return assign_judge_to_event(db, event_id, request.judge_id, actor)


@router.post(
    "/events/{event_id}/judge-assignments",
    response_model=JudgeAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign an event judge to a submitted project",
)
def project_judge_assign(
    event_id: UUID,
    request: JudgeProjectAssignmentCreate,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_project_assignment(
        db, event_id, request.project_id, request.judge_id, actor
    )


@router.get(
    "/events/{event_id}/judge-assignments",
    response_model=JudgeAssignmentListResponse,
    summary="List event assignment status for the organizer",
    description="Returns progress only, never evaluator feedback or score values.",
)
def organizer_assignment_index(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"items": list_organizer_assignments(db, event_id, actor)}


@router.get(
    "/events/{event_id}/judge-assignments/me",
    response_model=JudgeAssignmentListResponse,
    summary="List the current judge's event assignments",
)
def my_assignment_index(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"items": list_judge_assignments(db, event_id, actor)}


@router.get(
    "/judge-assignments/{assignment_id}",
    response_model=JudgeAssignmentDetailResponse,
    summary="Get an assigned project and its pinned rubric",
    description="Only the judge assigned to this project may access this route.",
)
def assignment_detail(
    assignment_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_judge_assignment(db, assignment_id, actor)


@router.get(
    "/judge-assignments/{assignment_id}/evaluation",
    response_model=EvaluationEnvelope,
    summary="Read the current judge's own evaluation",
)
def evaluation_detail(
    assignment_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_own_evaluation(db, assignment_id, actor)


@router.put(
    "/judge-assignments/{assignment_id}/evaluation",
    response_model=EvaluationResponse,
    summary="Save or replace the current judge's evaluation draft",
)
def evaluation_save(
    assignment_id: UUID,
    request: EvaluationDraftRequest,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return save_evaluation_draft(db, assignment_id, request, actor)


@router.post(
    "/judge-assignments/{assignment_id}/evaluation/submit",
    response_model=EvaluationResponse,
    summary="Finalize the current judge's evaluation",
    description="Every rubric criterion must have a valid score. Final evaluations cannot be edited.",
)
def evaluation_submit(
    assignment_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return submit_evaluation(db, assignment_id, actor)


@router.get(
    "/events/{event_id}/judging/progress",
    response_model=JudgingProgressResponse,
    summary="Get event judging progress",
    description="Organizer-only assignment counts by judge; no score values or feedback.",
)
def progress(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return judging_progress(db, event_id, actor)


@router.post(
    "/events/{event_id}/judging/results/recalculate",
    response_model=JudgingRecalculationResponse,
    summary="Calculate and persist an event-scoped normalized result snapshot",
)
def results_recalculate(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    snapshot = recalculate_results(db, event_id, actor)
    return {
        "snapshot_id": snapshot.id,
        "status": snapshot.status,
        "method": snapshot.method,
        "method_version": snapshot.method_version,
        "source_evaluation_count": snapshot.source_evaluation_count,
        "insufficient_reason": snapshot.insufficient_reason,
    }


@router.get(
    "/events/{event_id}/judging/results",
    response_model=JudgingResultsResponse,
    summary="Get the latest aggregate judging results",
    description="Organizer-only. Results are private to the event organizer; no participant publication endpoint exists in T2.",
)
def results(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return latest_results(db, event_id, actor)


@router.get(
    "/events/{event_id}/judging/results.csv",
    summary="Export event judging results as CSV",
    description="Organizer-only stable columns: event_slug,event_title,rubric_version,normalization_method,rank,project_id,project_title,team_id,raw_average,normalized_score,completed_evaluations,submitted_at,repository_url,demo_url. Formula-leading text is escaped.",
    responses={200: {"content": {"text/csv": {}}}},
)
def results_csv(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = export_results_csv(db, event_id, actor)
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="dogfood-{event_id}-judging-results.csv"'
        },
    )
