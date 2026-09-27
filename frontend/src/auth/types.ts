export type BackendRole = 'participant' | 'organizer' | 'admin';
// Judge is a demo workspace role; real event capabilities will be added separately.
export type Role = BackendRole | 'judge';
export const isBackendRole = (value: unknown): value is BackendRole =>
  value === 'participant' || value === 'organizer' || value === 'admin';
export type SessionStatus = 'loading' | 'anonymous' | 'authenticated';
export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
export interface Credentials { email: string; password: string }
export interface Registration extends Credentials { display_name: string }
export const isRole = (value: unknown): value is Role =>
  isBackendRole(value) || value === 'judge';
export const errorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return 'Something went wrong. Please try again.';
  const details = 'details' in error ? error.details : undefined;
  const messages = Array.isArray(details) ? details.flatMap(item =>
    item && typeof item === 'object' && typeof item.message === 'string'
      ? [Array.isArray(item.location) ? `${item.location.join('.')}: ${item.message}` : item.message] : []) : [];
  return [error.message, ...messages].join(' ');
};
