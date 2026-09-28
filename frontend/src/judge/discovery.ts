import { api, DEMO } from '../api';
import { getEvent, publicEvent } from '../data/events';
import type { PublicEvent } from '../data/publicData';

export interface JudgeEventChoice {
  event: PublicEvent;
  assignmentCount: number;
}

type JudgeCapability = {
  is_judge: boolean;
  event_ids: string[];
};

// Discovery is a hint, never a cached authorization grant.
// Workspace access is still checked by the backend.
export async function discoverJudgeEvents(
  _userId: string,
): Promise<JudgeEventChoice[]> {
  if (DEMO) {
    throw new Error('Real judge discovery is unavailable in demo mode.');
  }

  const capability = await api<JudgeCapability>('/api/judging/me');

  if (!capability.is_judge || !capability.event_ids?.length) {
    return [];
  }

  const choices: JudgeEventChoice[] = [];

  for (const eventId of capability.event_ids) {
    try {
      const event = await getEvent(eventId);

      if (!['published', 'active', 'completed'].includes(event.status)) {
        continue;
      }

      choices.push({
        event: publicEvent(event),
        assignmentCount: 1,
      });
    } catch {
      // Discovery is best-effort. Backend authorization remains authoritative.
    }
  }

  return choices;
}
