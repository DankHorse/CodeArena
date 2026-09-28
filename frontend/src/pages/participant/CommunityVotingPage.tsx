import { useEffect, useState } from 'react';
import { useParticipant } from '../../participant/ParticipantProvider';
import {
  addProjectComment,
  castCommunityVote,
  communityBallot,
  communityVoteStatus,
  projectComments,
  type CommunityProject,
  type ProjectComment,
} from '../../data/community';
import { errorMessage } from '../../auth/types';

export function CommunityVotingPage() {
  const { snapshot } = useParticipant();
  const eventId = snapshot?.event?.id;

  const [projects, setProjects] = useState<CommunityProject[]>([]);
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, ProjectComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentBusy, setCommentBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;

    let active = true;

    setLoading(true);
    setError('');

    void communityBallot(eventId)
      .then(async ballot => {
        if (!active) return;

        setProjects(ballot);

        const commentEntries = await Promise.all(
          ballot.map(async project => {
            try {
              const result = await projectComments(eventId, project.id);
              return [project.id, result] as const;
            } catch {
              return [project.id, []] as const;
            }
          }),
        );

        if (active) {
          setComments(Object.fromEntries(commentEntries));
        }

        const statuses = await Promise.all(
          ballot.map(async project => {
            try {
              const result = await communityVoteStatus(eventId, project.id);
              return [project.id, result.has_voted] as const;
            } catch {
              return [project.id, false] as const;
            }
          }),
        );

        if (active) {
          setVoted(Object.fromEntries(statuses));
        }
      })
      .catch(err => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [eventId]);

  async function vote(projectId: string) {
    if (!eventId || busy) return;

    setBusy(projectId);
    setError('');

    try {
      await castCommunityVote(eventId, projectId);
      setVoted(current => ({ ...current, [projectId]: true }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function submitComment(projectId: string) {
    if (!eventId || commentBusy) return;

    const body = (commentDrafts[projectId] ?? '').trim();
    if (!body) return;

    setCommentBusy(projectId);
    setError('');

    try {
      const created = await addProjectComment(eventId, projectId, body);
      setComments(current => ({
        ...current,
        [projectId]: [...(current[projectId] ?? []), created],
      }));
      setCommentDrafts(current => ({ ...current, [projectId]: '' }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCommentBusy(null);
    }
  }

  if (!eventId) {
    return (
      <section className="panel">
        <h1>COMMUNITY VOTING.</h1>
        <p>Select an event before entering the community ballot.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">[ PARTICIPANT / COMMUNITY ]</p>
        <h1>
          COMMUNITY VOTING<span className="heading-period">.</span>
        </h1>
        <p>
          Review submitted projects and cast your community vote.
          Results remain hidden while voting is open.
        </p>
      </div>

      {error && (
        <div className="team-message" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <p className="metadata" role="status">
          Loading ballot…
        </p>
      )}

      {!loading && !projects.length && (
        <section className="panel">
          <h2>NO PROJECTS AVAILABLE.</h2>
          <p>
            There are no submitted projects available for this voting window.
          </p>
        </section>
      )}

      <div className="gallery-projects" aria-label="Community voting ballot">
        {projects.map(project => {
          const hasVoted = voted[project.id] === true;

          return (
            <article className="gallery-card" key={project.id}>
              <div className="gallery-card-number">{project.id}</div>

              <div className="gallery-card-content">
                <p className="metadata">{project.eventTitle}</p>
                <h2>{project.title}</h2>
                <p>{project.summary}</p>

                <div className="public-actions">
                  {project.repoUrl && (
                    <a
                      className="button public-secondary"
                      href={project.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Repository ↗
                    </a>
                  )}

                  {project.demoUrl && (
                    <a
                      className="button public-secondary"
                      href={project.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Live demo ↗
                    </a>
                  )}

                  <button
                    className="button button-primary"
                    type="button"
                    disabled={hasVoted || busy !== null}
                    onClick={() => void vote(project.id)}
                  >
                    {hasVoted
                      ? 'Vote recorded'
                      : busy === project.id
                        ? 'Recording…'
                        : 'Vote for project'}
                  </button>
                </div>

                <div className="team-message" style={{ marginTop: '1rem' }}>
                  <strong>COMMENTS</strong>
                  <div style={{ marginTop: '0.75rem' }}>
                    {(comments[project.id] ?? []).length === 0 ? (
                      <p className="metadata">No comments yet.</p>
                    ) : (
                      (comments[project.id] ?? []).map(comment => (
                        <p key={comment.id}>{comment.body}</p>
                      ))
                    )}
                  </div>

                  <div className="public-actions" style={{ marginTop: '0.75rem' }}>
                    <input
                      aria-label={`Comment on ${project.title}`}
                      value={commentDrafts[project.id] ?? ''}
                      onChange={event =>
                        setCommentDrafts(current => ({
                          ...current,
                          [project.id]: event.target.value,
                        }))
                      }
                      placeholder="Leave a comment"
                      maxLength={2000}
                      disabled={commentBusy !== null}
                    />
                    <button
                      className="button public-secondary"
                      type="button"
                      disabled={
                        commentBusy !== null ||
                        !(commentDrafts[project.id] ?? '').trim()
                      }
                      onClick={() => void submitComment(project.id)}
                    >
                      {commentBusy === project.id ? 'Posting…' : 'Post comment'}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
