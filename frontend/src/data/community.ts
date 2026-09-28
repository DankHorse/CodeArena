import { api } from '../api';

export interface CommunityProject {
  id: string;
  eventSlug: string;
  eventTitle: string;
  title: string;
  summary: string;
  repoUrl?: string;
  demoUrl?: string;
  submittedAt: string;
}

interface BallotProjectRecord {
  id: string;
  event_slug: string;
  event_title: string;
  title: string;
  description: string;
  repository_url: string | null;
  demo_url: string | null;
  submitted_at: string;
}

export interface Vote {
  id: string;
  event_id: string;
  project_id: string;
  voter_id: string;
  created_at: string;
}

export interface VoteCheck {
  has_voted: boolean;
  vote: Vote | null;
}

export interface ProjectComment {
  id: string;
  event_id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

const adaptBallotProject = (
  record: BallotProjectRecord,
): CommunityProject => ({
  id: record.id,
  eventSlug: record.event_slug,
  eventTitle: record.event_title,
  title: record.title,
  summary: record.description,
  repoUrl: record.repository_url ?? undefined,
  demoUrl: record.demo_url ?? undefined,
  submittedAt: record.submitted_at,
});

export async function communityBallot(
  eventId: string,
): Promise<CommunityProject[]> {
  const records = await api<BallotProjectRecord[]>(
    `/api/events/${eventId}/ballot`,
  );

  return records.map(adaptBallotProject);
}

export async function castCommunityVote(
  eventId: string,
  projectId: string,
): Promise<Vote> {
  return api<Vote>(
    `/api/events/${eventId}/projects/${projectId}/vote`,
    'POST',
  );
}

export async function communityVoteStatus(
  eventId: string,
  projectId: string,
): Promise<VoteCheck> {
  return api<VoteCheck>(
    `/api/events/${eventId}/projects/${projectId}/vote`,
  );
}

export async function retractCommunityVote(
  eventId: string,
  projectId: string,
): Promise<void> {
  await api<void>(
    `/api/events/${eventId}/projects/${projectId}/vote`,
    'DELETE',
  );
}

export async function projectComments(
  eventId: string,
  projectId: string,
): Promise<ProjectComment[]> {
  return api<ProjectComment[]>(
    `/api/events/${eventId}/projects/${projectId}/comments`,
  );
}

export async function addProjectComment(
  eventId: string,
  projectId: string,
  body: string,
): Promise<ProjectComment> {
  return api<ProjectComment>(
    `/api/events/${eventId}/projects/${projectId}/comments`,
    'POST',
    { body },
  );
}
