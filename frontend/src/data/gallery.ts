import { api } from '../api';
import { listPublicEvents } from './events';
interface GalleryRecord { id: string; event_slug: string; event_title: string; title: string; description: string; repository_url: string | null; demo_url: string | null; submitted_at: string }
export interface GalleryProject { id: string; eventSlug: string; eventTitle: string; title: string; summary: string; repoUrl?: string; demoUrl?: string; submittedAt: string }
const adapt = (record: GalleryRecord): GalleryProject => ({ id: record.id, eventSlug: record.event_slug, eventTitle: record.event_title, title: record.title, summary: record.description, repoUrl: record.repository_url ?? undefined, demoUrl: record.demo_url ?? undefined, submittedAt: record.submitted_at });
export async function gallerySlug(eventId?: string, slug?: string) {
  if (slug) return slug;
  if (!eventId) return undefined;
  const event = (await listPublicEvents()).find(event => event.id === eventId);
  if (!event?.slug) throw Error('This event is not available publicly. Browse Events to choose another event.');
  return event.slug;
}
export async function galleryPage(offset = 0, search = '', eventSlug?: string, limit = 20) {
  const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (search.trim()) query.set('search', search.trim().slice(0, 100));
  if (eventSlug) query.set('event_slug', eventSlug);
  const result = await api<{ items: GalleryRecord[]; offset: number; limit: number; total: number }>(`/api/v1/gallery/projects?${query}`);
  return { ...result, items: result.items.map(adapt) };
}
export async function publicProject(id: string, slug?: string): Promise<GalleryProject | null> {
  // The private /projects endpoint is never used for public detail resolution.
  let offset = 0;
  for (let page = 0; page < 100; page++) {
    const result = await galleryPage(offset, '', slug, 100);
    const found = result.items.find(project => project.id === id);
    if (found) return found;
    offset += result.items.length;
    if (!result.items.length || offset >= result.total) return null;
  }
  throw Error('This gallery is too large to resolve directly. Open the project from its event gallery.');
}
