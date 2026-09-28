import { api, ApiError, DEMO } from '../api';
import { listPublicEvents } from '../data/events';
import type { PublicEvent } from '../data/publicData';
export interface JudgeEventChoice { event: PublicEvent; assignmentCount: number }
// Discovery is a hint, never a cached authorization grant. Workspace entry rechecks J1.
export async function discoverJudgeEvents(userId: string): Promise<JudgeEventChoice[]> {
  if (DEMO) throw new Error('Real judge discovery is unavailable in demo mode.');
  const events = await listPublicEvents();
  const choices: JudgeEventChoice[] = [];
  for (const event of events) {
    try {
      const { items } = await api<{ items: { event_id: string; judge_id: string; status: string }[] }>(`/api/v1/events/${encodeURIComponent(event.id)}/judge-assignments/me`);
      if (items.some(item => item.event_id !== event.id || item.judge_id !== userId)) throw new Error('Judge discovery returned mismatched assignment ownership.');
      const assignmentCount = items.filter(item => item.status !== 'revoked').length;
      if (assignmentCount) choices.push({ event, assignmentCount });
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status)) continue;
      throw error;
    }
  }
  return choices;
}
