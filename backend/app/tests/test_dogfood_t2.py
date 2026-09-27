import csv
import io
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.session import SessionLocal, get_engine
from app.main import app
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
from app.models.team import Team, TeamInvitation, TeamMember
from app.models.user import User


@pytest.fixture(autouse=True)
def clean_dogfood_t2_data():
    if not get_settings().database_url:
        pytest.skip("DATABASE_URL is not configured")
    yield
    with SessionLocal(bind=get_engine()) as db:
        events = select(Event.id).where(Event.slug.like("dogfood-t2-%"))
        evaluation_ids = select(JudgeEvaluation.id).where(JudgeEvaluation.event_id.in_(events))
        db.execute(delete(JudgeCriterionScore).where(JudgeCriterionScore.evaluation_id.in_(evaluation_ids)))
        db.execute(delete(JudgeEvaluation).where(JudgeEvaluation.event_id.in_(events)))
        db.execute(delete(JudgeProjectAssignment).where(JudgeProjectAssignment.event_id.in_(events)))
        db.execute(delete(JudgingProjectResult).where(JudgingProjectResult.event_id.in_(events)))
        db.execute(delete(JudgingResultSnapshot).where(JudgingResultSnapshot.event_id.in_(events)))
        db.execute(delete(JudgingRubricCriterion).where(JudgingRubricCriterion.event_id.in_(events)))
        db.execute(delete(JudgingRubric).where(JudgingRubric.event_id.in_(events)))
        db.execute(delete(JudgeEventAssignment).where(JudgeEventAssignment.event_id.in_(events)))
        db.execute(delete(ProjectSubmission).where(ProjectSubmission.event_id.in_(events)))
        db.execute(delete(TeamInvitation).where(TeamInvitation.event_id.in_(events)))
        db.execute(delete(TeamMember).where(TeamMember.event_id.in_(events)))
        db.execute(delete(Team).where(Team.event_id.in_(events)))
        db.execute(delete(EventRegistration).where(EventRegistration.event_id.in_(events)))
        db.execute(delete(Event).where(Event.slug.like("dogfood-t2-%")))
        db.execute(delete(User).where(User.email.like("dogfood-t2-%@example.com")))
        db.commit()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def make_user(role: str = "participant") -> User:
    user_id = uuid4()
    user = User(
        id=user_id,
        email=f"dogfood-t2-{user_id.hex}@example.com",
        password_hash="test-only-not-a-password-hash",
        display_name="DOGFOOD T2 Tester",
        role=role,
    )
    with SessionLocal(bind=get_engine()) as db:
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def auth(client: TestClient, user: User) -> None:
    client.cookies.set(get_settings().auth_cookie_name, create_access_token(user.id))


def payload_event():
    now = datetime.now(timezone.utc)
    return {
        "title": "DOGFOOD T2 Event",
        "slug": f"dogfood-t2-{uuid4().hex}",
        "description": "Event fixture for human judging.",
        "registration_opens_at": (now - timedelta(hours=1)).isoformat(),
        "registration_deadline": (now + timedelta(days=2)).isoformat(),
        "starts_at": (now + timedelta(days=3)).isoformat(),
        "submission_deadline": (now + timedelta(days=10)).isoformat(),
        "ends_at": (now + timedelta(days=11)).isoformat(),
        "team_min_size": 1,
        "team_max_size": 4,
    }


def create_event(client: TestClient, organizer: User) -> dict:
    auth(client, organizer)
    response = client.post("/api/v1/events", json=payload_event())
    assert response.status_code == 201, response.text
    event = response.json()
    published = client.post(
        f"/api/v1/events/{event['id']}/transition", json={"status": "published"}
    )
    assert published.status_code == 200, published.text
    return published.json()


def create_project(client: TestClient, event_id: str, participant: User, title: str) -> dict:
    auth(client, participant)
    assert client.post(f"/api/v1/events/{event_id}/registrations").status_code == 201
    team = client.post(f"/api/v1/events/{event_id}/teams", json={"name": f"Team {uuid4().hex[:6]}"})
    assert team.status_code == 201, team.text
    project = client.post(
        f"/api/v1/events/{event_id}/projects",
        json={"title": title, "description": "A submitted DOGFOOD project."},
    )
    assert project.status_code == 201, project.text
    submitted = client.post(f"/api/v1/projects/{project.json()['id']}/submit")
    assert submitted.status_code == 200, submitted.text
    return submitted.json()


def rubric_payload(weights=(60, 40)):
    return {
        "title": "DOGFOOD T2 Rubric",
        "criteria": [
            {"name": "Impact", "description": "Problem impact", "weight": weights[0], "max_score": 5, "position": 0},
            {"name": "Execution", "description": "Quality of execution", "weight": weights[1], "max_score": 5, "position": 1},
        ],
    }


def create_active_rubric(client: TestClient, event_id: str, organizer: User) -> dict:
    auth(client, organizer)
    created = client.post(f"/api/v1/events/{event_id}/rubrics", json=rubric_payload())
    assert created.status_code == 201, created.text
    active = client.post(
        f"/api/v1/events/{event_id}/rubrics/{created.json()['id']}/activate"
    )
    assert active.status_code == 200, active.text
    return active.json()


def enroll_judge(client: TestClient, event_id: str, organizer: User, judge: User):
    auth(client, organizer)
    response = client.post(
        f"/api/v1/events/{event_id}/judges", json={"judge_id": str(judge.id)}
    )
    assert response.status_code == 201, response.text
    return response.json()


def assign_project(client: TestClient, event_id: str, organizer: User, project_id: str, judge: User):
    auth(client, organizer)
    response = client.post(
        f"/api/v1/events/{event_id}/judge-assignments",
        json={"project_id": project_id, "judge_id": str(judge.id)},
    )
    assert response.status_code == 201, response.text
    return response.json()


def score_body(criteria: list[dict], first=4, second=3, feedback="Useful feedback"):
    return {
        "scores": [
            {"criterion_id": criteria[0]["id"], "score": first},
            {"criterion_id": criteria[1]["id"], "score": second},
        ],
        "feedback": feedback,
    }


def score_assignment(client: TestClient, assignment: dict, judge: User, criteria: list[dict], first=4, second=3):
    auth(client, judge)
    saved = client.put(
        f"/api/v1/judge-assignments/{assignment['id']}/evaluation",
        json=score_body(criteria, first, second),
    )
    assert saved.status_code == 200, saved.text
    submitted = client.post(
        f"/api/v1/judge-assignments/{assignment['id']}/evaluation/submit"
    )
    assert submitted.status_code == 200, submitted.text
    return submitted.json()


def test_organizer_creates_valid_versioned_rubric_and_invalid_weights_fail(client):
    organizer = make_user("organizer")
    event = create_event(client, organizer)
    auth(client, organizer)
    invalid = client.post(
        f"/api/v1/events/{event['id']}/rubrics", json=rubric_payload((80, 10))
    )
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "VALIDATION_ERROR"
    created = client.post(
        f"/api/v1/events/{event['id']}/rubrics", json=rubric_payload()
    )
    assert created.status_code == 201, created.text
    rubric = created.json()
    assert rubric["version"] == 1
    assert rubric["status"] == "draft"
    assert [row["position"] for row in rubric["criteria"]] == [0, 1]
    assert sum((Decimal(row["weight"]) for row in rubric["criteria"]), Decimal("0")) == Decimal("100")
    active = client.post(f"/api/v1/events/{event['id']}/rubrics/{rubric['id']}/activate")
    assert active.status_code == 200
    assert active.json()["status"] == "active"


def test_rubric_management_is_event_owner_only_and_versions_lock_when_assignments_start(client):
    organizer, other = make_user("organizer"), make_user("organizer")
    event = create_event(client, organizer)
    active = create_active_rubric(client, event["id"], organizer)
    project = create_project(client, event["id"], make_user(), "Rubric lock project")
    judge = make_user()
    enroll_judge(client, event["id"], organizer, judge)
    assign_project(client, event["id"], organizer, project["id"], judge)

    auth(client, organizer)
    draft = client.post(f"/api/v1/events/{event['id']}/rubrics", json=rubric_payload())
    assert draft.status_code == 201
    locked = client.post(f"/api/v1/events/{event['id']}/rubrics/{draft.json()['id']}/activate")
    assert locked.status_code == 409
    assert locked.json()["error"]["code"] == "RUBRIC_LOCKED"
    auth(client, other)
    denied = client.get(f"/api/v1/events/{event['id']}/rubrics")
    assert denied.status_code == 403
    denied = client.post(f"/api/v1/events/{event['id']}/rubrics/{active['id']}/activate")
    assert denied.status_code == 403


def test_judge_event_and_project_assignments_validate_scope_and_deduplicate(client):
    organizer = make_user("organizer")
    event = create_event(client, organizer)
    rubric = create_active_rubric(client, event["id"], organizer)
    judge, other = make_user(), make_user()
    project = create_project(client, event["id"], make_user(), "Assigned project")
    enroll_judge(client, event["id"], organizer, judge)

    auth(client, organizer)
    duplicate_event_judge = client.post(
        f"/api/v1/events/{event['id']}/judges", json={"judge_id": str(judge.id)}
    )
    assert duplicate_event_judge.status_code == 409
    unassigned_judge = client.post(
        f"/api/v1/events/{event['id']}/judge-assignments",
        json={"project_id": project["id"], "judge_id": str(other.id)},
    )
    assert unassigned_judge.status_code == 409
    assignment = assign_project(client, event["id"], organizer, project["id"], judge)
    duplicate = client.post(
        f"/api/v1/events/{event['id']}/judge-assignments",
        json={"project_id": project["id"], "judge_id": str(judge.id)},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "ASSIGNMENT_EXISTS"
    other_organizer = make_user("organizer")
    auth(client, other_organizer)
    unauthorized_change = client.post(
        f"/api/v1/events/{event['id']}/judge-assignments",
        json={"project_id": project["id"], "judge_id": str(other.id)},
    )
    assert unauthorized_change.status_code == 403

    second_event = create_event(client, make_user("organizer"))
    cross_event = client.post(
        f"/api/v1/events/{second_event['id']}/judge-assignments",
        json={"project_id": project["id"], "judge_id": str(judge.id)},
    )
    assert cross_event.status_code == 404
    assert cross_event.json()["error"]["code"] == "PROJECT_NOT_FOUND"
    assert rubric["event_id"] == event["id"]
    assert assignment["event_id"] == event["id"]


def test_event_user_cannot_be_both_participant_and_judge(client):
    organizer = make_user("organizer")
    event = create_event(client, organizer)
    participant = make_user()
    auth(client, participant)
    assert client.post(f"/api/v1/events/{event['id']}/registrations").status_code == 201
    auth(client, organizer)
    assigned_participant = client.post(
        f"/api/v1/events/{event['id']}/judges",
        json={"judge_id": str(participant.id)},
    )
    assert assigned_participant.status_code == 409
    assert assigned_participant.json()["error"]["code"] == "JUDGE_CONFLICT"

    judge = make_user()
    assigned = client.post(
        f"/api/v1/events/{event['id']}/judges", json={"judge_id": str(judge.id)}
    )
    assert assigned.status_code == 201
    auth(client, judge)
    registration = client.post(f"/api/v1/events/{event['id']}/registrations")
    assert registration.status_code == 409
    assert registration.json()["error"]["code"] == "JUDGE_CONFLICT"


def test_judge_scores_assigned_project_and_invalid_scores_are_rejected(client):
    organizer = make_user("organizer")
    event = create_event(client, organizer)
    rubric = create_active_rubric(client, event["id"], organizer)
    judge, peer, participant = make_user(), make_user(), make_user()
    project = create_project(client, event["id"], participant, "Scoring target")
    enroll_judge(client, event["id"], organizer, judge)
    assignment = assign_project(client, event["id"], organizer, project["id"], judge)
    criteria = rubric["criteria"]

    auth(client, peer)
    peer_write = client.put(
        f"/api/v1/judge-assignments/{assignment['id']}/evaluation",
        json=score_body(criteria),
    )
    assert peer_write.status_code == 403
    auth(client, participant)
    participant_read = client.get(
        f"/api/v1/judge-assignments/{assignment['id']}/evaluation"
    )
    assert participant_read.status_code == 403

    auth(client, judge)
    too_high = client.put(
        f"/api/v1/judge-assignments/{assignment['id']}/evaluation",
        json=score_body(criteria, first=6),
    )
    assert too_high.status_code == 422
    assert too_high.json()["error"]["code"] == "SCORE_OUT_OF_RANGE"
    wrong_criterion = client.put(
        f"/api/v1/judge-assignments/{assignment['id']}/evaluation",
        json={"scores": [{"criterion_id": str(uuid4()), "score": 2}], "feedback": ""},
    )
    assert wrong_criterion.status_code == 422
    assert wrong_criterion.json()["error"]["code"] == "INVALID_CRITERION"
    saved = client.put(
        f"/api/v1/judge-assignments/{assignment['id']}/evaluation",
        json=score_body(criteria),
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["status"] == "draft"
    assert saved.json()["feedback"] == "Useful feedback"
    assert Decimal(saved.json()["weighted_score"]) == Decimal("72")
    submitted = client.post(
        f"/api/v1/judge-assignments/{assignment['id']}/evaluation/submit"
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "submitted"
    assert submitted.json()["submitted_at"]
    locked = client.put(
        f"/api/v1/judge-assignments/{assignment['id']}/evaluation",
        json=score_body(criteria, first=1, second=1),
    )
    assert locked.status_code == 409


def test_judge_reads_only_own_assignments_evaluations_and_rubric(client):
    organizer = make_user("organizer")
    event = create_event(client, organizer)
    rubric = create_active_rubric(client, event["id"], organizer)
    judge, peer, participant = make_user(), make_user(), make_user()
    project = create_project(client, event["id"], participant, "Private judge project")
    enroll_judge(client, event["id"], organizer, judge)
    enroll_judge(client, event["id"], organizer, peer)
    assignment = assign_project(client, event["id"], organizer, project["id"], judge)
    score_assignment(client, assignment, judge, rubric["criteria"])

    auth(client, judge)
    mine = client.get(f"/api/v1/events/{event['id']}/judge-assignments/me")
    assert mine.status_code == 200
    assert [row["id"] for row in mine.json()["items"]] == [assignment["id"]]
    private = client.get(f"/api/v1/judge-assignments/{assignment['id']}/evaluation")
    assert private.status_code == 200
    assert private.json()["evaluation"]["feedback"] == "Useful feedback"
    own_scores = client.get("/api/v1/judging/scores")
    assert own_scores.status_code == 200
    assert [row["assignment_id"] for row in own_scores.json()["items"]] == [assignment["id"]]
    detail = client.get(f"/api/v1/judge-assignments/{assignment['id']}")
    assert detail.status_code == 200
    assert detail.json()["project"]["id"] == project["id"]
    assert detail.json()["rubric"]["version"] == rubric["version"]
    auth(client, peer)
    peer_read = client.get(f"/api/v1/judge-assignments/{assignment['id']}/evaluation")
    assert peer_read.status_code == 403
    peer_scores = client.get(
        f"/api/v1/judging/scores?judge={judge.id}"
    )
    assert peer_scores.status_code == 403
    assert peer_scores.json()["error"]["code"] == "FORBIDDEN"
    own_scores_as_peer = client.get("/api/v1/judging/scores")
    assert own_scores_as_peer.status_code == 200
    assert own_scores_as_peer.json()["items"] == []
    peer_list = client.get(f"/api/v1/events/{event['id']}/judge-assignments/me")
    assert peer_list.status_code == 200
    assert peer_list.json()["items"] == []
    organizer_only = client.get(f"/api/v1/events/{event['id']}/judging/results")
    assert organizer_only.status_code == 403
    organizer_only = client.get(f"/api/v1/events/{event['id']}/judging/progress")
    assert organizer_only.status_code == 403
    auth(client, participant)
    assert client.get("/api/v1/judging/scores").status_code == 403
    participant_rubric = client.get(f"/api/v1/events/{event['id']}/rubric")
    assert participant_rubric.status_code == 403
    unassigned = make_user()
    auth(client, unassigned)
    assert client.get("/api/v1/judging/scores").status_code == 403


def test_progress_is_organizer_only_and_contains_counts_not_private_scores(client):
    organizer = make_user("organizer")
    event = create_event(client, organizer)
    rubric = create_active_rubric(client, event["id"], organizer)
    judge, participant = make_user(), make_user()
    project = create_project(client, event["id"], participant, "Progress project")
    enroll_judge(client, event["id"], organizer, judge)
    assignment = assign_project(client, event["id"], organizer, project["id"], judge)
    auth(client, organizer)
    pending = client.get(f"/api/v1/events/{event['id']}/judging/progress")
    assert pending.status_code == 200
    assert pending.json()["total_assignments"] == 1
    assert pending.json()["pending_evaluations"] == 1
    assert Decimal(pending.json()["completion_percentage"]) == Decimal("0")
    score_assignment(client, assignment, judge, rubric["criteria"])
    auth(client, organizer)
    completed = client.get(f"/api/v1/events/{event['id']}/judging/progress")
    assert completed.json()["completed_evaluations"] == 1
    assert Decimal(completed.json()["completion_percentage"]) == Decimal("100")
    assert "feedback" not in completed.text
    assert "weighted_score" not in completed.text
    auth(client, participant)
    assert client.get(f"/api/v1/events/{event['id']}/judging/progress").status_code == 403


def test_normalization_snapshot_is_deterministic_and_preserves_raw_evaluations(client):
    organizer = make_user("organizer")
    event = create_event(client, organizer)
    rubric = create_active_rubric(client, event["id"], organizer)
    judges = [make_user(), make_user()]
    projects = [
        create_project(client, event["id"], make_user(), "Normal project one"),
        create_project(client, event["id"], make_user(), "Normal project two"),
    ]
    assignments = {}
    for judge in judges:
        enroll_judge(client, event["id"], organizer, judge)
        for project in projects:
            assignments[(judge.id, project["id"])] = assign_project(
                client, event["id"], organizer, project["id"], judge
            )
    score_assignment(client, assignments[(judges[0].id, projects[0]["id"])], judges[0], rubric["criteria"], 5, 5)
    score_assignment(client, assignments[(judges[0].id, projects[1]["id"])], judges[0], rubric["criteria"], 1, 1)
    score_assignment(client, assignments[(judges[1].id, projects[0]["id"])], judges[1], rubric["criteria"], 5, 2.5)
    score_assignment(client, assignments[(judges[1].id, projects[1]["id"])], judges[1], rubric["criteria"], 0, 0)

    auth(client, organizer)
    first = client.post(f"/api/v1/events/{event['id']}/judging/results/recalculate")
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "ready"
    assert first.json()["method"] == "judge_mean_center"
    assert first.json()["method_version"] == "1.0"
    results_one = client.get(f"/api/v1/events/{event['id']}/judging/results")
    assert results_one.status_code == 200
    assert results_one.json()["is_stale"] is False
    rows = results_one.json()["items"]
    assert rows[0]["project_id"] == projects[0]["id"]
    assert Decimal(rows[0]["normalized_score"]) == Decimal("90")
    assert Decimal(rows[1]["normalized_score"]) == Decimal("10")
    with SessionLocal(bind=get_engine()) as db:
        raw_before = list(
            db.scalars(
                select(JudgeEvaluation.weighted_score).where(
                    JudgeEvaluation.event_id == event["id"],
                    JudgeEvaluation.status == "submitted",
                )
            )
        )
        assert len(raw_before) == 4
    second = client.post(f"/api/v1/events/{event['id']}/judging/results/recalculate")
    assert second.status_code == 200
    results_two = client.get(f"/api/v1/events/{event['id']}/judging/results")
    assert [row["normalized_score"] for row in results_one.json()["items"]] == [
        row["normalized_score"] for row in results_two.json()["items"]
    ]
    with SessionLocal(bind=get_engine()) as db:
        raw_after = list(
            db.scalars(
                select(JudgeEvaluation.weighted_score).where(
                    JudgeEvaluation.event_id == event["id"],
                    JudgeEvaluation.status == "submitted",
                )
            )
        )
        assert raw_after == raw_before
        snapshots = list(
            db.scalars(
                select(JudgingResultSnapshot).where(JudgingResultSnapshot.event_id == event["id"])
            )
        )
        assert len(snapshots) == 2
        assert all(row.method_version == "1.0" for row in snapshots)
        assert all(
            row.parameters["weighted_score_version"] == "weighted_percentage_v1"
            for row in snapshots
        )

    later_project = create_project(
        client, event["id"], make_user(), "Project submitted after snapshot"
    )
    for judge in judges:
        later_assignment = assign_project(
            client, event["id"], organizer, later_project["id"], judge
        )
        score_assignment(client, later_assignment, judge, rubric["criteria"])
    auth(client, organizer)
    stale = client.get(f"/api/v1/events/{event['id']}/judging/results")
    assert stale.status_code == 200
    assert stale.json()["is_stale"] is True
    stale_export = client.get(f"/api/v1/events/{event['id']}/judging/results.csv")
    assert stale_export.status_code == 200
    stale_rows = list(csv.DictReader(io.StringIO(stale_export.text)))
    assert len(stale_rows) == 3
    assert all(row["normalized_score"] == "" for row in stale_rows)


def test_normalization_insufficient_data_is_explicit_and_not_exportable(client):
    organizer = make_user("organizer")
    event = create_event(client, organizer)
    rubric = create_active_rubric(client, event["id"], organizer)
    judges = [make_user(), make_user()]
    project = create_project(client, event["id"], make_user(), "Only project")
    assignments = []
    for judge in judges:
        enroll_judge(client, event["id"], organizer, judge)
        assignments.append(assign_project(client, event["id"], organizer, project["id"], judge))
    for judge, assignment in zip(judges, assignments, strict=True):
        score_assignment(client, assignment, judge, rubric["criteria"])
    auth(client, organizer)
    snapshot = client.post(f"/api/v1/events/{event['id']}/judging/results/recalculate")
    assert snapshot.status_code == 200
    assert snapshot.json()["status"] == "insufficient_data"
    assert "two submitted evaluations" in snapshot.json()["insufficient_reason"]
    latest = client.get(f"/api/v1/events/{event['id']}/judging/results")
    assert latest.status_code == 200
    assert latest.json()["items"] == []
    export = client.get(f"/api/v1/events/{event['id']}/judging/results.csv")
    assert export.status_code == 200
    csv_rows = list(csv.DictReader(io.StringIO(export.text)))
    assert len(csv_rows) == 1
    assert csv_rows[0]["normalized_score"] == ""
    assert Decimal(csv_rows[0]["raw_average"]) == Decimal("72")


def test_results_and_csv_are_organizer_only_and_escape_formula_text(client):
    organizer = make_user("organizer")
    event = create_event(client, organizer)
    rubric = create_active_rubric(client, event["id"], organizer)
    judges = [make_user(), make_user()]
    formula_title = "=HYPERLINK(\"https://attacker.invalid\",\"click\")"
    projects = [
        create_project(client, event["id"], make_user(), formula_title),
        create_project(client, event["id"], make_user(), "Plain project"),
    ]
    assignments = {}
    for judge in judges:
        enroll_judge(client, event["id"], organizer, judge)
        for project in projects:
            assignments[(judge.id, project["id"])] = assign_project(
                client, event["id"], organizer, project["id"], judge
            )
    for judge in judges:
        for project in projects:
            score_assignment(
                client,
                assignments[(judge.id, project["id"])],
                judge,
                rubric["criteria"],
                4,
                4,
            )
    auth(client, organizer)
    uncalculated = client.get(f"/api/v1/events/{event['id']}/judging/results.csv")
    assert uncalculated.status_code == 200
    uncalculated_rows = list(csv.DictReader(io.StringIO(uncalculated.text)))
    assert len(uncalculated_rows) == 2
    assert all(row["normalized_score"] == "" for row in uncalculated_rows)
    assert client.post(f"/api/v1/events/{event['id']}/judging/results/recalculate").status_code == 200
    exported = client.get(f"/api/v1/events/{event['id']}/judging/results.csv")
    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith("text/csv")
    rows = list(csv.DictReader(io.StringIO(exported.text)))
    assert rows
    assert list(rows[0]) == [
        "event_slug", "event_title", "rubric_version", "normalization_method", "rank",
        "project_id", "project_title", "team_id", "raw_average", "normalized_score",
        "completed_evaluations", "submitted_at", "repository_url", "demo_url",
    ]
    escaped = next(row["project_title"] for row in rows if "HYPERLINK" in row["project_title"])
    assert escaped.startswith("'=")
    participant = make_user()
    auth(client, participant)
    assert client.get(f"/api/v1/events/{event['id']}/judging/results").status_code == 403
    assert client.get(f"/api/v1/events/{event['id']}/judging/results.csv").status_code == 403
    auth(client, judges[0])
    assert client.get(f"/api/v1/events/{event['id']}/judging/results").status_code == 403
    assert client.get(f"/api/v1/events/{event['id']}/judging/results.csv").status_code == 403


def test_migration_created_distinct_human_judging_tables(client):
    from sqlalchemy import inspect

    inspector = inspect(get_engine())
    expected = {
        "dogfood_rubrics",
        "dogfood_rubric_criteria",
        "dogfood_judge_event_assignments",
        "dogfood_judge_project_assignments",
        "dogfood_judge_evaluations",
        "dogfood_judge_criterion_scores",
        "dogfood_judging_result_snapshots",
        "dogfood_judging_project_results",
    }
    assert expected.issubset(set(inspector.get_table_names()))
    assert "submissions" in inspector.get_table_names()
    assert "submission_test_results" in inspector.get_table_names()
