const withEvent = (path: string, eventId?: string) =>
  eventId ? `${path}?${new URLSearchParams({ event: eventId })}` : path;

export const paths = {
  home: '/',
  events: '/events',
  eventPattern: '/events/:eventId',
  event: (id: string) => `/events/${encodeURIComponent(id)}`,
  gallery: (eventId?: string) => withEvent('/gallery', eventId),
  projectPattern: '/projects/:projectId',
  project: (id: string, eventId?: string) => withEvent(`/projects/${encodeURIComponent(id)}`, eventId),
  login: '/login',
  participantLogin: '/participant/login',
  judgeLogin: '/judge/login',
  organizerLogin: '/organizer/login',
  register: '/register',
  participant: {
    home: '/participant', team: '/participant/team', submission: '/participant/submission',
  },
  judge: {
    home: '/judge', assignments: '/judge/assignments', rubric: '/judge/rubric',
    reviewPattern: '/judge/review/:projectId',
    review: (id: string) => `/judge/review/${encodeURIComponent(id)}`,
  },
  organizer: {
    home: '/organizer', events: '/organizer/events', teams: '/organizer/teams',
    projects: '/organizer/projects', rubric: '/organizer/rubric', judges: '/organizer/judges',
    results: '/organizer/results', activity: '/organizer/activity',
  },
} as const;
