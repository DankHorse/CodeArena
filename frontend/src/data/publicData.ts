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

// Read-only public projections. Importing api.ts would initialize mutable demo storage.
// Practice IDs and metadata match the existing API mock; drafts are not public.
export const publicEvents: PublicEvent[] = [
  {
    id: fixture.event.id,
    name: fixture.event.name,
    description: 'The official fixture event: 41 project records, 30 judges, eight tracks, and the real edge cases a judging platform needs to handle.',
    submissionsClose: fixture.event.submissions_close,
    tracks: fixture.tracks,
  },
  {
    id: 'evt_practice',
    name: 'Open Circuit / Practice Arena',
    description: 'Build something useful. Find your team. Put your idea in front of reviewers. A practice event for exploring the complete CodeArena workflow.',
    submissionsClose: '2099-12-31T18:00:00Z',
    tracks: ['Developer tools', 'Climate', 'Open hardware'].map((name, index) => ({ id: `demo_trk_${index}`, name })),
  },
];

export const publicProjects: PublicProject[] = [
  ...fixture.projects.map(project => ({
    id: project.id,
    eventId: fixture.event.id,
    title: project.title,
    summary: project.summary,
    team: fixture.teams.find(team => team.id === project.team)?.name ?? 'Unknown team',
    track: fixture.tracks.find(track => track.id === project.track)?.name ?? 'Unassigned',
    status: 'Submitted' as const,
    repoUrl: project.repo_url,
  })),
  {
    id: 'demo_prj_1', eventId: 'evt_practice', title: 'Gridwise',
    summary: 'Smarter energy decisions for community microgrids.',
    team: 'Northstar', track: 'Climate', status: 'Submitted', repoUrl: 'https://example.org/gridwise',
  },
  {
    id: 'demo_prj_2', eventId: 'evt_practice', title: 'OpenCircuit',
    summary: 'Collaborative hardware schematics that work offline.',
    team: 'Northstar', track: 'Open hardware', status: 'Submitted', repoUrl: 'https://example.org/opencircuit',
  },
];

export const findEvent = (id?: string) => publicEvents.find(event => event.id === id);
export const findProject = (id?: string) => publicProjects.find(project => project.id === id);
export const eventStatus = (event: PublicEvent) =>
  Date.now() >= Date.parse(event.submissionsClose) ? 'Submissions closed' : 'Submissions open';
export const formatDeadline = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value)) + ' UTC';
