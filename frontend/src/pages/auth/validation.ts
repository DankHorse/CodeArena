import { ApiError } from '../../api';

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

type AuthField = 'email' | 'password' | 'name';

export function authValidationField(error: unknown): AuthField | null {
  if (!(error instanceof ApiError) || error.status < 400) return null;
  const evidence = `${error.message} ${JSON.stringify(error.details ?? '')}`.toLowerCase();
  if (/email/.test(evidence)) return 'email';
  if (/password/.test(evidence)) return 'password';
  if (/display[_ ]?name|\bname\b/.test(evidence)) return 'name';
  return null;
}

export function safeLoginError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Invalid email or password.';
    if (authValidationField(error) === 'email') return 'Please enter a valid email address.';
    if (authValidationField(error) === 'password') return 'Please check your password and try again.';
    return 'Unable to sign in. Please try again.';
  }
  return error instanceof Error && [
    'This account is not assigned as a judge.',
    'This account is not a participant account.',
    'This account is not an organizer or admin account.',
  ].includes(error.message) ? error.message : 'Unable to sign in. Please try again.';
}

export function safeRegisterError(error: unknown): { field: AuthField | null; message: string } {
  const field = authValidationField(error);
  if (field === 'email') return { field, message: 'Please enter a valid email address.' };
  if (field === 'password') return { field, message: 'Password must be at least 12 characters.' };
  if (field === 'name') return { field, message: 'Please enter your name.' };
  return { field: null, message: 'Unable to create your account. Please try again.' };
}
