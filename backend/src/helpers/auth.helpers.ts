export { hashPassword, comparePasswords, generateOTP, hashOTP } from '../modules/auth/auth.helpers.js';

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function normalizeUsername(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}
