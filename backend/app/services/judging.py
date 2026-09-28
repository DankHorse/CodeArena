import csv
import io
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.models.event import Event, EventRegistration
from app.models.judging import (
    JudgeCriterionScore,
    JudgeEvaluation,
    JudgeEventAssignment,
    JudgeProjectAssignment,
    JudgingProjectResult,
    JudgingResultSnapshot,
    JudgingRubric,
    JudgingRubricCriterion,
)
from app.models.project import ProjectSubmission
from app.models.user import User
from app.schemas.judging import EvaluationDraftRequest, RubricCreate

NORMALIZATION_METHOD = "judge_mean_center"
NORMALIZATION_VERSION = "1.0"
WEIGHTED_SCORE_VERSION = "weighted_percentage_v1"
_FOUR_PLACES = Decimal("0.0001")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _round(value: Decimal) -> Decimal:
    return value.quantize(_FOUR_PLACES, rounding=ROUND_HALF_UP)


def _event(db: Session, event_id: UUID) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise APIError(404, "EVENT_NOT_FOUND", "Event was not found")
    return event


def _ensure_results_visible(event: Event) -> None:
    now = _now()
    if (
        event.voting_opens_at is not None
        and event.voting_ends_at is not None
        and event.voting_opens_at <= now < event.voting_ends_at
    ):
        raise APIError(
            409,
            "RESULTS_HIDDEN_DURING_VOTING",
            "Judging results are hidden while community voting is open",
        )


def _organizer_event(
    db: Session, event_id: UUID, actor: User, *, lock: bool = False
) -> Event:
    statement = select(Event).where(Event.id == event_id)
    if lock:
        statement = statement.with_for_update()
    event = db.scalar(statement)
    if event is None:
        raise APIError(404, "EVENT_NOT_FOUND", "Event was not found")
    if actor.role not in {"organizer", "admin"} or event.organizer_id != actor.id:
        raise APIError(403, "FORBIDDEN", "Only this event's organizer can manage judging")
    return event


def _rubric_response(db: Session, rubric: JudgingRubric) -> dict:
    criteria = db.scalars(
        select(JudgingRubricCriterion)
        .where(JudgingRubricCriterion.rubric_id == rubric.id)
        .order_by(JudgingRubricCriterion.position, JudgingRubricCriterion.id)
    )
    return {
        "id": rubric.id,
        "event_id": rubric.event_id,
        "version": rubric.version,
        "title": rubric.title,
        "status": rubric.status,
        "created_at": rubric.created_at,
        "activated_at": rubric.activated_at,
        "criteria": list(criteria),
    }


def _active_rubric(db: Session, event_id: UUID) -> JudgingRubric:
    rubric = db.scalar(
        select(JudgingRubric).where(
            JudgingRubric.event_id == event_id, JudgingRubric.status == "active"
        )
    )
    if rubric is None:
        raise APIError(409, "ACTIVE_RUBRIC_REQUIRED", "An active rubric is required")
    return rubric


def create_rubric(
    db: Session, event_id: UUID, request: RubricCreate, actor: User
) -> dict:
    _organizer_event(db, event_id, actor, lock=True)
    rubric = JudgingRubric(
        event_id=event_id,
        version=(db.scalar(select(func.max(JudgingRubric.version)).where(JudgingRubric.event_id == event_id)) or 0) + 1,
        title=request.title,
        status="draft",
        created_by=actor.id,
    )
    db.add(rubric)
    db.flush()
    db.add_all(
        [
            JudgingRubricCriterion(
                rubric_id=rubric.id,
                event_id=event_id,
                name=criterion.name,
                description=criterion.description,
                weight=criterion.weight,
                max_score=criterion.max_score,
                position=criterion.position,
            )
            for criterion in request.criteria
        ]
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(409, "RUBRIC_VERSION_CONFLICT", "A rubric version was created concurrently") from exc
    db.refresh(rubric)
    return _rubric_response(db, rubric)


def list_rubrics(db: Session, event_id: UUID, actor: User) -> list[dict]:
    _organizer_event(db, event_id, actor, lock=True)
    rubrics = db.scalars(
        select(JudgingRubric)
        .where(JudgingRubric.event_id == event_id)
        .order_by(JudgingRubric.version.desc())
    )
    return [_rubric_response(db, rubric) for rubric in rubrics]


def get_event_rubric(db: Session, event_id: UUID, actor: User) -> dict:
    event = _event(db, event_id)
    is_owner = event.organizer_id == actor.id and actor.role in {"organizer", "admin"}
    judge = db.scalar(
        select(JudgeEventAssignment.id).where(
            JudgeEventAssignment.event_id == event_id,
            JudgeEventAssignment.judge_id == actor.id,
            JudgeEventAssignment.status == "active",
        )
    )
    if not is_owner and judge is None:
        raise APIError(403, "FORBIDDEN", "Rubric access is restricted to this event's organizer and judges")
    return _rubric_response(db, _active_rubric(db, event_id))


def activate_rubric(
    db: Session, event_id: UUID, rubric_id: UUID, actor: User
) -> dict:
    _organizer_event(db, event_id, actor, lock=True)
    rubric = db.scalar(
        select(JudgingRubric)
        .where(JudgingRubric.id == rubric_id, JudgingRubric.event_id == event_id)
        .with_for_update()
    )
    if rubric is None:
        raise APIError(404, "RUBRIC_NOT_FOUND", "Rubric was not found for this event")
    if rubric.status != "draft":
        raise APIError(409, "RUBRIC_IMMUTABLE", "Only a draft rubric can be activated")
    if db.scalar(
        select(JudgeProjectAssignment.id).where(JudgeProjectAssignment.event_id == event_id).limit(1)
    ) is not None:
        raise APIError(409, "RUBRIC_LOCKED", "A rubric cannot change after project assignments begin")
    active = db.scalar(
        select(JudgingRubric)
        .where(JudgingRubric.event_id == event_id, JudgingRubric.status == "active")
        .with_for_update()
    )
    if active is not None:
        active.status = "archived"
    rubric.status = "active"
    rubric.activated_at = _now()
    db.commit()
    db.refresh(rubric)
    return _rubric_response(db, rubric)


def assign_judge_to_event(
    db: Session, event_id: UUID, judge_id: UUID, actor: User
) -> JudgeEventAssignment:
    event = _organizer_event(db, event_id, actor, lock=True)
    if event.status not in {"published", "active"}:
        raise APIError(409, "EVENT_NOT_JUDGABLE", "Judges can only be assigned to published or active events")
    judge = db.get(User, judge_id)
    if judge is None or not judge.is_active or judge.role != "participant":
        raise APIError(404, "JUDGE_NOT_FOUND", "An active participant account is required")
    if judge_id == event.organizer_id:
        raise APIError(409, "JUDGE_CONFLICT", "The event organizer cannot be assigned as a judge")
    registered = db.scalar(
        select(EventRegistration.id).where(
            EventRegistration.event_id == event_id,
            EventRegistration.user_id == judge_id,
        )
    )
    if registered is not None:
        raise APIError(409, "JUDGE_CONFLICT", "An event participant cannot judge the same event")
    existing = db.scalar(
        select(JudgeEventAssignment).where(
            JudgeEventAssignment.event_id == event_id,
            JudgeEventAssignment.judge_id == judge_id,
        )
    )
    if existing is not None:
        if existing.status == "active":
            raise APIError(409, "JUDGE_ALREADY_ASSIGNED", "Judge is already assigned to this event")
        existing.status = "active"
        existing.assigned_by = actor.id
        db.commit()
        db.refresh(existing)
        return existing
    row = JudgeEventAssignment(event_id=event_id, judge_id=judge_id, assigned_by=actor.id)
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(409, "JUDGE_ALREADY_ASSIGNED", "Judge is already assigned to this event") from exc
    db.refresh(row)
    return row


def create_project_assignment(
    db: Session, event_id: UUID, project_id: UUID, judge_id: UUID, actor: User
) -> JudgeProjectAssignment:
    event = _organizer_event(db, event_id, actor, lock=True)
    if event.status not in {"published", "active", "completed"}:
        raise APIError(409, "EVENT_NOT_JUDGABLE", "This event is not accepting judging assignments")
    project = db.get(ProjectSubmission, project_id)
    if project is None or project.event_id != event_id:
        raise APIError(404, "PROJECT_NOT_FOUND", "Submitted project was not found for this event")
    if project.status != "submitted":
        raise APIError(409, "PROJECT_NOT_SUBMITTED", "Only submitted projects can be assigned")
    judge_event = db.scalar(
        select(JudgeEventAssignment).where(
            JudgeEventAssignment.event_id == event_id,
            JudgeEventAssignment.judge_id == judge_id,
            JudgeEventAssignment.status == "active",
        )
    )
    if judge_event is None:
        raise APIError(409, "JUDGE_NOT_ASSIGNED", "Judge must be assigned to this event first")
    rubric = _active_rubric(db, event_id)
    duplicate = db.scalar(
        select(JudgeProjectAssignment.id).where(
            JudgeProjectAssignment.project_id == project_id,
            JudgeProjectAssignment.judge_id == judge_id,
        )
    )
    if duplicate is not None:
        raise APIError(409, "ASSIGNMENT_EXISTS", "Judge is already assigned to this project")
    row = JudgeProjectAssignment(
        event_id=event_id,
        project_id=project_id,
        judge_id=judge_id,
        rubric_id=rubric.id,
        assigned_by=actor.id,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(409, "ASSIGNMENT_EXISTS", "Judge is already assigned to this project") from exc
    db.refresh(row)
    return row


def list_organizer_assignments(
    db: Session, event_id: UUID, actor: User
) -> list[JudgeProjectAssignment]:
    _organizer_event(db, event_id, actor)
    return list(
        db.scalars(
            select(JudgeProjectAssignment)
            .where(JudgeProjectAssignment.event_id == event_id)
            .order_by(JudgeProjectAssignment.created_at, JudgeProjectAssignment.id)
        )
    )


def list_judge_assignments(
    db: Session, event_id: UUID, actor: User
) -> list[JudgeProjectAssignment]:
    membership = db.scalar(
        select(JudgeEventAssignment.id).where(
            JudgeEventAssignment.event_id == event_id,
            JudgeEventAssignment.judge_id == actor.id,
            JudgeEventAssignment.status == "active",
        )
    )
    if membership is None:
        raise APIError(403, "FORBIDDEN", "You are not a judge for this event")
    return list(
        db.scalars(
            select(JudgeProjectAssignment)
            .where(
                JudgeProjectAssignment.event_id == event_id,
                JudgeProjectAssignment.judge_id == actor.id,
                JudgeProjectAssignment.status != "revoked",
            )
            .order_by(JudgeProjectAssignment.created_at, JudgeProjectAssignment.id)
        )
    )


def _judge_assignment(
    db: Session, assignment_id: UUID, actor: User, *, lock: bool = False
) -> JudgeProjectAssignment:
    statement = select(JudgeProjectAssignment).where(
        JudgeProjectAssignment.id == assignment_id,
        JudgeProjectAssignment.judge_id == actor.id,
        JudgeProjectAssignment.status != "revoked",
    )
    if lock:
        statement = statement.with_for_update()
    assignment = db.scalar(statement)
    if assignment is None:
        raise APIError(403, "FORBIDDEN", "Judge assignments are private to their assignee")
    event_assignment = db.scalar(
        select(JudgeEventAssignment.id).where(
            JudgeEventAssignment.event_id == assignment.event_id,
            JudgeEventAssignment.judge_id == actor.id,
            JudgeEventAssignment.status == "active",
        )
    )
    if event_assignment is None:
        raise APIError(403, "FORBIDDEN", "Judge event access is no longer active")
    return assignment


def _rubric_for_assignment(db: Session, assignment: JudgeProjectAssignment) -> dict:
    rubric = db.get(JudgingRubric, assignment.rubric_id)
    if rubric is None:
        raise APIError(409, "RUBRIC_NOT_FOUND", "Assignment rubric is unavailable")
    return _rubric_response(db, rubric)


def get_judge_assignment(
    db: Session, assignment_id: UUID, actor: User
) -> dict:
    assignment = _judge_assignment(db, assignment_id, actor)
    project = db.get(ProjectSubmission, assignment.project_id)
    if project is None or project.event_id != assignment.event_id:
        raise APIError(404, "PROJECT_NOT_FOUND", "Assigned project was not found")
    if project.status != "submitted":
        raise APIError(409, "PROJECT_NOT_SUBMITTED", "Assigned project is no longer available")
    return {
        "assignment": assignment,
        "project": project,
        "rubric": _rubric_for_assignment(db, assignment),
    }


def _evaluation_response(db: Session, evaluation: JudgeEvaluation) -> dict:
    criteria = list(
        db.scalars(
            select(JudgingRubricCriterion)
            .where(JudgingRubricCriterion.rubric_id == evaluation.rubric_id)
            .order_by(JudgingRubricCriterion.position, JudgingRubricCriterion.id)
        )
    )
    scores = {
        score.criterion_id: score
        for score in db.scalars(
            select(JudgeCriterionScore).where(JudgeCriterionScore.evaluation_id == evaluation.id)
        )
    }
    output = []
    for criterion in criteria:
        score = scores.get(criterion.id)
        if score is None:
            continue
        contribution = (score.raw_score / criterion.max_score) * criterion.weight
        output.append(
            {
                "criterion_id": criterion.id,
                "name": criterion.name,
                "weight": criterion.weight,
                "max_score": criterion.max_score,
                "raw_score": score.raw_score,
                "weighted_contribution": _round(contribution),
            }
        )
    return {
        "id": evaluation.id,
        "assignment_id": evaluation.assignment_id,
        "rubric_id": evaluation.rubric_id,
        "status": evaluation.status,
        "feedback": evaluation.feedback,
        "weighted_score": evaluation.weighted_score,
        "scores": output,
        "created_at": evaluation.created_at,
        "updated_at": evaluation.updated_at,
        "submitted_at": evaluation.submitted_at,
    }


def get_own_evaluation(
    db: Session, assignment_id: UUID, actor: User
) -> dict:
    assignment = _judge_assignment(db, assignment_id, actor)
    evaluation = db.scalar(
        select(JudgeEvaluation).where(JudgeEvaluation.assignment_id == assignment.id)
    )
    if evaluation is None:
        return {"evaluation": None}
    return {"evaluation": _evaluation_response(db, evaluation)}


def list_own_judge_scores(
    db: Session, actor: User, requested_judge: str | None = None
) -> dict:
    if requested_judge is not None:
        raise APIError(403, "FORBIDDEN", "Judges may only read their own scores")
    event_ids = list(
        db.scalars(
            select(JudgeEventAssignment.event_id).where(
                JudgeEventAssignment.judge_id == actor.id,
                JudgeEventAssignment.status == "active",
            )
        )
    )
    if not event_ids:
        raise APIError(403, "FORBIDDEN", "An active event judge assignment is required")
    rows = db.execute(
        select(JudgeProjectAssignment, JudgeEvaluation)
        .outerjoin(JudgeEvaluation, JudgeEvaluation.assignment_id == JudgeProjectAssignment.id)
        .where(
            JudgeProjectAssignment.event_id.in_(event_ids),
            JudgeProjectAssignment.judge_id == actor.id,
            JudgeProjectAssignment.status != "revoked",
        )
        .order_by(JudgeProjectAssignment.event_id, JudgeProjectAssignment.created_at)
    )
    return {
        "items": [
            {
                "event_id": assignment.event_id,
                "assignment_id": assignment.id,
                "project_id": assignment.project_id,
                "evaluation": _evaluation_response(db, evaluation) if evaluation else None,
            }
            for assignment, evaluation in rows
        ]
    }


def save_evaluation_draft(
    db: Session,
    assignment_id: UUID,
    request: EvaluationDraftRequest,
    actor: User,
) -> dict:
    assignment = _judge_assignment(db, assignment_id, actor, lock=True)
    if assignment.status == "submitted":
        raise APIError(409, "EVALUATION_LOCKED", "Submitted evaluations are immutable")
    criteria = list(
        db.scalars(
            select(JudgingRubricCriterion).where(
                JudgingRubricCriterion.rubric_id == assignment.rubric_id
            )
        )
    )
    criterion_map = {criterion.id: criterion for criterion in criteria}
    for item in request.scores:
        criterion = criterion_map.get(item.criterion_id)
        if criterion is None:
            raise APIError(422, "INVALID_CRITERION", "Score criterion is not part of this assignment rubric")
        if item.score > criterion.max_score:
            raise APIError(422, "SCORE_OUT_OF_RANGE", f"Score for {criterion.name} exceeds its maximum")
    evaluation = db.scalar(
        select(JudgeEvaluation).where(JudgeEvaluation.assignment_id == assignment.id)
    )
    if evaluation is None:
        evaluation = JudgeEvaluation(
            assignment_id=assignment.id,
            event_id=assignment.event_id,
            judge_id=actor.id,
            rubric_id=assignment.rubric_id,
        )
        db.add(evaluation)
        db.flush()
    else:
        db.execute(delete(JudgeCriterionScore).where(JudgeCriterionScore.evaluation_id == evaluation.id))
    evaluation.feedback = request.feedback
    values = {item.criterion_id: item.score for item in request.scores}
    evaluation.weighted_score = None
    if len(values) == len(criteria):
        evaluation.weighted_score = _round(
            sum(
                (
                    (values[criterion.id] / criterion.max_score) * criterion.weight
                    for criterion in criteria
                ),
                Decimal("0"),
            )
        )
    db.add_all(
        [
            JudgeCriterionScore(
                evaluation_id=evaluation.id,
                criterion_id=criterion_id,
                rubric_id=assignment.rubric_id,
                raw_score=score,
            )
            for criterion_id, score in values.items()
        ]
    )
    assignment.status = "in_progress"
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(409, "EVALUATION_CONFLICT", "Evaluation was changed concurrently") from exc
    db.refresh(evaluation)
    return _evaluation_response(db, evaluation)


def submit_evaluation(db: Session, assignment_id: UUID, actor: User) -> dict:
    assignment = _judge_assignment(db, assignment_id, actor, lock=True)
    if assignment.status == "submitted":
        raise APIError(409, "EVALUATION_LOCKED", "Evaluation has already been submitted")
    evaluation = db.scalar(
        select(JudgeEvaluation).where(JudgeEvaluation.assignment_id == assignment.id).with_for_update()
    )
    if evaluation is None:
        raise APIError(409, "EVALUATION_INCOMPLETE", "Save scores before submitting")
    criteria = list(
        db.scalars(
            select(JudgingRubricCriterion).where(
                JudgingRubricCriterion.rubric_id == assignment.rubric_id
            )
        )
    )
    scores = list(
        db.scalars(select(JudgeCriterionScore).where(JudgeCriterionScore.evaluation_id == evaluation.id))
    )
    if len(scores) != len(criteria) or {score.criterion_id for score in scores} != {c.id for c in criteria}:
        raise APIError(409, "EVALUATION_INCOMPLETE", "Every rubric criterion must be scored")
    score_map = {score.criterion_id: score.raw_score for score in scores}
    total = _round(
        sum(
            (
                (score_map[criterion.id] / criterion.max_score) * criterion.weight
                for criterion in criteria
            ),
            Decimal("0"),
        )
    )
    evaluation.weighted_score = total
    evaluation.status = "submitted"
    evaluation.submitted_at = _now()
    assignment.status = "submitted"
    db.commit()
    db.refresh(evaluation)
    return _evaluation_response(db, evaluation)


def judging_progress(db: Session, event_id: UUID, actor: User) -> dict:
    _organizer_event(db, event_id, actor)
    assignments = list(
        db.scalars(
            select(JudgeProjectAssignment)
            .where(
                JudgeProjectAssignment.event_id == event_id,
                JudgeProjectAssignment.status != "revoked",
            )
            .order_by(JudgeProjectAssignment.judge_id, JudgeProjectAssignment.id)
        )
    )
    groups: dict[UUID, list[JudgeProjectAssignment]] = defaultdict(list)
    for assignment in assignments:
        groups[assignment.judge_id].append(assignment)
    judges = []
    for judge_id, rows in sorted(groups.items(), key=lambda item: str(item[0])):
        complete = sum(row.status == "submitted" for row in rows)
        active = sum(row.status == "in_progress" for row in rows)
        judges.append(
            {
                "judge_id": judge_id,
                "assignments": len(rows),
                "completed": complete,
                "in_progress": active,
                "pending": len(rows) - complete - active,
                "completion_percentage": _round(Decimal(complete * 100) / len(rows)) if rows else Decimal("0"),
            }
        )
    total = len(assignments)
    completed = sum(row.status == "submitted" for row in assignments)
    in_progress = sum(row.status == "in_progress" for row in assignments)
    return {
        "event_id": event_id,
        "total_assignments": total,
        "completed_evaluations": completed,
        "pending_evaluations": total - completed - in_progress,
        "in_progress_evaluations": in_progress,
        "completion_percentage": _round(Decimal(completed * 100) / total) if total else Decimal("0"),
        "judges": judges,
    }


def recalculate_results(db: Session, event_id: UUID, actor: User) -> JudgingResultSnapshot:
    _organizer_event(db, event_id, actor)
    rubric = _active_rubric(db, event_id)
    rows = list(
        db.execute(
            select(JudgeEvaluation, JudgeProjectAssignment, ProjectSubmission)
            .join(JudgeProjectAssignment, JudgeProjectAssignment.id == JudgeEvaluation.assignment_id)
            .join(ProjectSubmission, ProjectSubmission.id == JudgeProjectAssignment.project_id)
            .where(
                JudgeEvaluation.event_id == event_id,
                JudgeEvaluation.rubric_id == rubric.id,
                JudgeEvaluation.status == "submitted",
                JudgeProjectAssignment.status == "submitted",
            )
            .order_by(JudgeEvaluation.judge_id, JudgeProjectAssignment.project_id, JudgeEvaluation.id)
        )
    )
    assigned_judges = set(
        db.scalars(
            select(JudgeProjectAssignment.judge_id).where(
                JudgeProjectAssignment.event_id == event_id,
                JudgeProjectAssignment.status != "revoked",
            )
        )
    )
    per_judge: dict[UUID, list[tuple[JudgeEvaluation, JudgeProjectAssignment, ProjectSubmission]]] = defaultdict(list)
    for evaluation, assignment, project in rows:
        if evaluation.weighted_score is not None:
            per_judge[evaluation.judge_id].append((evaluation, assignment, project))
    insufficient_reason = None
    if len(assigned_judges) < 2:
        insufficient_reason = "At least two assigned judges are required."
    elif any(len(per_judge.get(judge_id, ())) < 2 for judge_id in assigned_judges):
        insufficient_reason = "Each judge needs at least two submitted evaluations for mean-centering."
    source_count = sum(len(items) for items in per_judge.values())
    snapshot = JudgingResultSnapshot(
        event_id=event_id,
        rubric_id=rubric.id,
        method=NORMALIZATION_METHOD,
        method_version=NORMALIZATION_VERSION,
        status="insufficient_data" if insufficient_reason else "ready",
        insufficient_reason=insufficient_reason,
        source_evaluation_count=source_count,
        parameters={
            "score_scale": "0-100 weighted percentage",
            "weighted_score_version": WEIGHTED_SCORE_VERSION,
            "judge_minimum_evaluations": 2,
            "minimum_judges": 2,
            "clip_range": [0, 100],
            "rounding": "half-up to 4 decimal places",
        },
        created_by=actor.id,
    )
    db.add(snapshot)
    db.flush()
    if insufficient_reason is None:
        all_scores = [evaluation.weighted_score for items in per_judge.values() for evaluation, _, _ in items]
        grand_mean = sum(all_scores, Decimal("0")) / len(all_scores)
        judge_means = {
            judge_id: sum((row[0].weighted_score for row in items), Decimal("0")) / len(items)
            for judge_id, items in per_judge.items()
        }
        per_project: dict[UUID, list[tuple[Decimal, Decimal]]] = defaultdict(list)
        for judge_id, items in per_judge.items():
            for evaluation, assignment, _project in items:
                raw = evaluation.weighted_score
                normalized = min(
                    Decimal("100"),
                    max(Decimal("0"), raw - judge_means[judge_id] + grand_mean),
                )
                per_project[assignment.project_id].append((raw, normalized))
        db.add_all(
            [
                JudgingProjectResult(
                    snapshot_id=snapshot.id,
                    event_id=event_id,
                    project_id=project_id,
                    raw_average=_round(sum((item[0] for item in values), Decimal("0")) / len(values)),
                    normalized_score=_round(sum((item[1] for item in values), Decimal("0")) / len(values)),
                    evaluation_count=len(values),
                )
                for project_id, values in per_project.items()
            ]
        )
    db.commit()
    db.refresh(snapshot)
    return snapshot


def latest_results(db: Session, event_id: UUID, actor: User) -> dict:
    event = _organizer_event(db, event_id, actor)
    _ensure_results_visible(event)
    snapshot = db.scalar(
        select(JudgingResultSnapshot)
        .where(JudgingResultSnapshot.event_id == event_id)
        .order_by(JudgingResultSnapshot.created_at.desc(), JudgingResultSnapshot.id.desc())
        .limit(1)
    )
    if snapshot is None:
        raise APIError(404, "RESULTS_NOT_CALCULATED", "Organizer must calculate results first")
    current_count = db.scalar(
        select(func.count()).select_from(JudgeEvaluation).where(
            JudgeEvaluation.event_id == event_id,
            JudgeEvaluation.status == "submitted",
        )
    ) or 0
    stale = current_count != snapshot.source_evaluation_count
    rows = list(
        db.execute(
            select(JudgingProjectResult, ProjectSubmission)
            .join(ProjectSubmission, ProjectSubmission.id == JudgingProjectResult.project_id)
            .where(
                JudgingProjectResult.snapshot_id == snapshot.id,
                JudgingProjectResult.event_id == event_id,
            )
            .order_by(
                JudgingProjectResult.normalized_score.desc().nullslast(),
                JudgingProjectResult.raw_average.desc(),
                ProjectSubmission.title,
                ProjectSubmission.id,
            )
        )
    )
    items = []
    rank = 0
    previous_score = None
    for index, (result, project) in enumerate(rows, start=1):
        if result.normalized_score != previous_score:
            rank = index
            previous_score = result.normalized_score
        items.append(
            {
                "rank": rank if snapshot.status == "ready" else None,
                "project_id": project.id,
                "project_title": project.title,
                "team_id": project.team_id,
                "raw_average": result.raw_average,
                "normalized_score": result.normalized_score,
                "completed_evaluations": result.evaluation_count,
            }
        )
    return {
        "event_id": event_id,
        "snapshot_id": snapshot.id,
        "status": snapshot.status,
        "method": snapshot.method,
        "method_version": snapshot.method_version,
        "calculated_at": snapshot.created_at,
        "source_evaluation_count": snapshot.source_evaluation_count,
        "is_stale": stale,
        "insufficient_reason": snapshot.insufficient_reason,
        "items": items,
    }


def _spreadsheet_safe(value: object) -> str:
    text_value = str(value if value is not None else "")
    if text_value.lstrip(" \t\r\n").startswith(("=", "+", "-", "@")):
        return "'" + text_value
    return text_value


CSV_COLUMNS = (
    "event_slug",
    "event_title",
    "rubric_version",
    "normalization_method",
    "rank",
    "project_id",
    "project_title",
    "team_id",
    "raw_average",
    "normalized_score",
    "completed_evaluations",
    "submitted_at",
    "repository_url",
    "demo_url",
)


def export_results_csv(db: Session, event_id: UUID, actor: User) -> str:
    event = _organizer_event(db, event_id, actor)
    _ensure_results_visible(event)
    try:
        results = latest_results(db, event_id, actor)
    except APIError as exc:
        if exc.code != "RESULTS_NOT_CALCULATED":
            raise
        results = None
    normalized = bool(
        results and results["status"] == "ready" and not results["is_stale"]
    )
    snapshot = db.get(JudgingResultSnapshot, results["snapshot_id"]) if results else None
    rubric = db.get(JudgingRubric, snapshot.rubric_id) if snapshot else None
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=CSV_COLUMNS, extrasaction="ignore", lineterminator="\r\n")
    writer.writeheader()
    if normalized:
        project_rows = [
            (item["project_id"], item["raw_average"], item["normalized_score"], item["rank"], item["completed_evaluations"])
            for item in results["items"]
        ]
        method = f"{results['method']}_v{results['method_version']}"
    else:
        raw_rows = db.execute(
            select(
                ProjectSubmission.id,
                func.avg(JudgeEvaluation.weighted_score),
                func.count(JudgeEvaluation.id),
            )
            .join(JudgeProjectAssignment, JudgeProjectAssignment.project_id == ProjectSubmission.id)
            .join(JudgeEvaluation, JudgeEvaluation.assignment_id == JudgeProjectAssignment.id)
            .where(
                ProjectSubmission.event_id == event_id,
                ProjectSubmission.status == "submitted",
                JudgeProjectAssignment.status == "submitted",
                JudgeEvaluation.status == "submitted",
                JudgeEvaluation.weighted_score.is_not(None),
            )
            .group_by(ProjectSubmission.id)
            .order_by(func.avg(JudgeEvaluation.weighted_score).desc(), ProjectSubmission.title, ProjectSubmission.id)
        )
        project_rows = [
            (project_id, raw_average, "", "", evaluation_count)
            for project_id, raw_average, evaluation_count in raw_rows
        ]
        if results and results["is_stale"]:
            method = "stale_snapshot_ignored"
        elif results:
            method = f"{results['method']}_v{results['method_version']} (insufficient_data)"
        else:
            method = "not_calculated"
    for project_id, raw_average, normalized_score, rank, evaluation_count in project_rows:
        project = db.get(ProjectSubmission, project_id)
        row = {
            "event_slug": event.slug,
            "event_title": event.title,
            "rubric_version": rubric.version if rubric else "",
            "normalization_method": method,
            "rank": rank,
            "project_id": project_id,
            "project_title": project.title if project else "",
            "team_id": project.team_id if project else "",
            "raw_average": _round(Decimal(raw_average)),
            "normalized_score": normalized_score,
            "completed_evaluations": evaluation_count,
            "submitted_at": project.submitted_at.isoformat() if project and project.submitted_at else "",
            "repository_url": project.repository_url if project else "",
            "demo_url": project.demo_url if project else "",
        }
        writer.writerow({key: _spreadsheet_safe(value) for key, value in row.items()})
    return buffer.getvalue()
