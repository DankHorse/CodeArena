import fixture from '../fixtures.json';

export type PublicEvent = {
  id: string;
  name: string;
  description: string;
  submissionsClose: string;
  tracks: { id: string; name: string }[];
};

export type PublicProject = {
  id: string;
  eventId: string;
  title: string;
  summary: string;
  team: string;
  track: string;
  status: 'Submitted';
  repoUrl?: string;
  demoUrl?: string;
};

export type PublicCatalog = {
  events: PublicEvent[];
  projects: PublicProject[];
};

export const publicEvents: PublicEvent[] = [
  {
    id: fixture.event.id,
    name: fixture.event.name,
    description:
      'The official fixture event: 41 project records, 30 judges, eight tracks, and the real edge cases a judging platform needs to handle.',
    submissionsClose: fixture.event.submissions_close,
    tracks: fixture.tracks,
  },
  {
    id: 'evt_practice',
    name: 'Open Circuit / Practice Arena',
    description:
      'Build something useful. Find your team. Put your idea in front of reviewers. A practice event for exploring the complete CodeArena workflow.',
    submissionsClose: '2099-12-31T18:00:00Z',
    tracks: ['Developer tools', 'Climate', 'Open hardware'].map(
      (name, index) => ({ id: `demo_trk_${index}`, name }),
    ),
  },
];

export const publicProjects: PublicProject[] = [
  ...fixture.projects.map(project => ({
    id: project.id,
    eventId: fixture.event.id,
    title: project.title,
    summary: project.summary,
    team:
      fixture.teams.find(team => team.id === project.team)?.name ??
      'Unknown team',
    track:
      fixture.tracks.find(track => track.id === project.track)?.name ??
      'Unassigned',
    status: 'Submitted' as const,
    repoUrl: project.repo_url,
  })),
  {
    id: 'demo_prj_1',
    eventId: 'evt_practice',
    title: 'Gridwise',
    summary: 'Smarter energy decisions for community microgrids.',
    team: 'Northstar',
    track: 'Climate',
    status: 'Submitted',
    repoUrl: 'https://example.org/gridwise',
  },
  {
    id: 'demo_prj_2',
    eventId: 'evt_practice',
    title: 'OpenCircuit',
    summary: 'Collaborative hardware schematics that work offline.',
    team: 'Northstar',
    track: 'Open hardware',
    status: 'Submitted',
    repoUrl: 'https://example.org/opencircuit',
  },
];

type BootstrapEvent = {
  id: string;
  name: string;
  description?: string;
  submissions_close: string;
};

type BootstrapTrack = {
  id: string;
  event_id: string;
  name: string;
};

type BootstrapTeam = {
  id: string;
  name: string;
  event_id: string;
};

type BootstrapProject = {
  id: string;
  event_id: string;
  team_id: string;
  track_id: string;
  title: string;
  summary?: string;
  description?: string;
  state?: string;
  repo_url?: string;
  demo_url?: string;
};

type BootstrapResponse = {
  events: BootstrapEvent[];
  tracks: BootstrapTrack[];
  teams: BootstrapTeam[];
  projects: BootstrapProject[];
};

export async function loadPublicCatalog(): Promise<PublicCatalog> {
  if (import.meta.env.VITE_DEMO !== 'true') {
    return {
      events: publicEvents,
      projects: publicProjects,
    };
  }

  const { api } = await import('../api');
  const bootstrap = await api<BootstrapResponse>('/api/bootstrap');

  const teams = new Map(
    bootstrap.teams.map(team => [team.id, team.name]),
  );

  const tracks = new Map(
    bootstrap.tracks.map(track => [track.id, track.name]),
  );

  const events: PublicEvent[] = bootstrap.events.map(event => ({
    id: event.id,
    name: event.name,
    description: event.description ?? '',
    submissionsClose: event.submissions_close,
    tracks: bootstrap.tracks
      .filter(track => track.event_id === event.id)
      .map(track => ({
        id: track.id,
        name: track.name,
      })),
  }));

  const projects: PublicProject[] = bootstrap.projects
    // Public pages must never expose drafts, even when an organizer
    // or participant is currently signed in.
    .filter(project => project.state === 'submitted')
    .map(project => ({
      id: project.id,
      eventId: project.event_id,
      title: project.title,
      summary: project.summary ?? project.description ?? '',
      team: teams.get(project.team_id) ?? 'Unknown team',
      track: tracks.get(project.track_id) ?? 'Unassigned',
      status: 'Submitted' as const,
      repoUrl: project.repo_url,
      demoUrl: project.demo_url,
    }));

  return { events, projects };
}

export const findEvent = (
  events: PublicEvent[],
  id?: string,
) => events.find(event => event.id === id);

export const findProject = (
  projects: PublicProject[],
  id?: string,
) => projects.find(project => project.id === id);

export const eventStatus = (event: PublicEvent) =>
  Date.now() >= Date.parse(event.submissionsClose)
    ? 'Submissions closed'
    : 'Submissions open';

export const formatDeadline = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC';
