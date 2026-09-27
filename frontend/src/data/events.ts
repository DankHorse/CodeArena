import { api } from '../api';
import type { PublicEvent } from './publicData';

export type EventStatus = 'draft' | 'published' | 'active' | 'completed' | 'cancelled';
export interface EventFields {
  title: string; description: string;
  registration_opens_at: string; registration_deadline: string; starts_at: string;
  submission_deadline: string; ends_at: string;
  team_min_size: number; team_max_size: number;
}
export interface BackendEvent extends EventFields {
  id: string; slug: string; status: EventStatus; organizer_id?: string;
}
export const publicEvent = (event: BackendEvent): PublicEvent => ({
  id: event.id, slug: event.slug, name: event.title, description: event.description,
  submissionsClose: event.submission_deadline, registrationClose: event.registration_deadline,
  registrationOpens: event.registration_opens_at, lifecycle: event.status, tracks: [],
});
export async function listPublicEvents(): Promise<PublicEvent[]> {
  const events: PublicEvent[] = [];
  let offset = 0;
  while (true) {
    const page = await api<{ items: BackendEvent[]; total: number; offset: number; limit: number }>(`/api/v1/events?offset=${offset}&limit=100`);
    events.push(...page.items.filter(event => ['published', 'active', 'completed'].includes(event.status)).map(publicEvent));
    offset += page.items.length;
    if (offset >= page.total || !page.items.length) return events;
  }
}
export const getEvent = (id: string) => api<BackendEvent>(`/api/v1/events/${encodeURIComponent(id)}`);
export function validateEvent(fields: EventFields) {
  if (!fields.title.trim() || !fields.description.trim()) throw new Error('Enter an event title and description.');
  const dates = [fields.registration_opens_at, fields.registration_deadline, fields.starts_at, fields.submission_deadline, fields.ends_at];
  if (dates.some(date => !/(Z|[+-]\d{2}:\d{2})$/i.test(date))) throw new Error('Event dates must include a timezone.');
  const times = dates.map(Date.parse);
  if (times.some((time, i) => !Number.isFinite(time) || (i > 0 && time < times[i - 1]))) throw new Error('Event dates must be valid and in chronological order.');
  if (![fields.team_min_size, fields.team_max_size].every(value => Number.isInteger(value) && value >= 1) || fields.team_min_size > fields.team_max_size) throw new Error('Team sizes must be positive integers, with minimum no greater than maximum.');
}
export async function saveEvent(fields: EventFields, id?: string) {
  validateEvent(fields);
  return api<BackendEvent>(id ? `/api/v1/events/${encodeURIComponent(id)}` : '/api/v1/events', id ? 'PATCH' : 'POST', fields);
}
export const publishEvent = (id: string) => api<BackendEvent>(`/api/v1/events/${encodeURIComponent(id)}/transition`, 'POST', { status: 'published' });
