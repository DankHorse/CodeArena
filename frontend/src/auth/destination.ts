import { DEMO } from '../api';
import { paths } from '../routes';
import type { Role } from './types';

export const workspaceFor = (role: Role) => paths[role === 'admin' ? 'organizer' : role].home;
export function loginDestination(role: Role, state: unknown): string {
  const home = workspaceFor(role);
  if (!state || typeof state !== 'object' || !('from' in state) || typeof state.from !== 'string') return home;
  const from = state.from;
  // Only local paths within the authenticated role's workspace are eligible.
  const pathname = from.split(/[?#]/)[0];
  if (from.includes('\\') || pathname.split('/').some(part => part === '.' || part === '..')) return home;
  if (!DEMO && role === 'participant' && /^\/events\/[0-9a-f-]+$/i.test(pathname)) return from;
  return pathname === home || pathname.startsWith(`${home}/`) ? from : home;
}
