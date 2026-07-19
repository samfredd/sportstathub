// The administrator credential is held only in backend-issued httpOnly
// cookies. This module stores a non-authoritative display descriptor; backend
// /api/admin/* guards remain the source of truth for every privileged action.
export interface AdminUser {
  id?: number;
  email?: string;
  username?: string;
  role?: string;
}

const ADMIN_USER_KEY = 'admin_user';

export function storeAdminUser(user: AdminUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ADMIN_USER_KEY);
  // Purge credentials from versions that predated the httpOnly-cookie model.
  localStorage.removeItem('admin_token');
  document.cookie = 'admin_token=; Path=/admin; Max-Age=0; SameSite=Lax';
}

export function getStoredUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    return raw ? JSON.parse(raw) as AdminUser : null;
  } catch { return null; }
}
