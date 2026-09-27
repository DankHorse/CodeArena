import { DEMO } from '../api';

export function judgeEventId(search: string): string | undefined {
  const values = new URLSearchParams(search).getAll('event');
  return values.length === 1 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(values[0]) ? values[0] : undefined;
}
export function judgePath(path: string, eventId?: string): string {
  return !DEMO && eventId ? `${path}?event=${encodeURIComponent(eventId)}` : path;
}
