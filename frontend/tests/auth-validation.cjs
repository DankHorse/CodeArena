const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');

class ApiError extends Error {
  constructor(message, status, details) { super(message); this.status = status; this.details = details; }
}
const load = runtime(false, () => {}, { '../../api': { ApiError } });
const validation = load('pages/auth/validation.ts');

assert.equal(validation.isValidEmail('bad-email'), false);
assert.equal(validation.isValidEmail('person@example.com'), true);
assert.equal(validation.safeRegisterError(new ApiError('Request validation failed body.email: value is not a valid email address', 422)).message, 'Please enter a valid email address.');
assert.equal(validation.safeRegisterError(new ApiError('Request validation failed body.password: too short', 422)).message, 'Password must be at least 12 characters.');
assert.equal(validation.safeLoginError(new ApiError('Unauthorized', 401)), 'Invalid email or password.');
assert.equal(validation.safeLoginError(new ApiError('Request validation failed body.email: invalid', 422)), 'Please enter a valid email address.');
assert.equal(validation.safeLoginError(new Error('This account is not assigned as a judge.')), 'This account is not assigned as a judge.');
assert.equal(validation.safeLoginError(new ApiError('raw implementation detail', 500)), 'Unable to sign in. Please try again.');
console.log('PASS authentication validation messages are field-specific and never expose API error text.');
