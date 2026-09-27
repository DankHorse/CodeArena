export type Role = 'participant' | 'judge' | 'organizer';
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
  value === 'participant' || value === 'judge' || value === 'organizer';
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
