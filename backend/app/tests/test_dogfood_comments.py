from uuid import uuid4

from app.models.comment import ProjectComment


def test_project_comment_model_metadata():
    table = ProjectComment.__table__

    assert table.name == "project_comments"
    assert "event_id" in table.c
    assert "project_id" in table.c
    assert "author_id" in table.c
    assert "body" in table.c

    fk_names = {fk.name for fk in table.foreign_key_constraints}
    assert "fk_project_comments_project_event" in fk_names
    assert "fk_project_comments_author" in fk_names


def test_project_comment_ids_are_uuid():
    comment = ProjectComment(
        event_id=uuid4(),
        project_id=uuid4(),
        author_id=uuid4(),
        body="Looks good.",
    )

    assert comment.event_id is not None
    assert comment.project_id is not None
    assert comment.author_id is not None
    assert comment.body == "Looks good."
