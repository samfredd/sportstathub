/**
 * Client session state.
 *
 * The JWT itself lives in an httpOnly cookie the browser sends automatically —
 * it is NOT readable from JavaScript (XSS-safe). What we keep in localStorage is
 * only a non-sensitive descriptor of the signed-in user (id / email / role /
 * username) so the UI can render the right state without a round-trip. Losing or
 * tampering with this object cannot grant access: every protected API call is
 * authorised by the cookie and enforced server-side.
 */

export interface SessionUser {
  id?: number;
  email?: string;
  role?: string;
  username?: string;
  avatar_url?: string;
}

const KEY = "auth_user";
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setSessionUser(user: SessionUser | null | undefined) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(user ?? {}));
    // Clear any legacy JWT left in localStorage from older builds.
    window.localStorage.removeItem("token");
    clearApiResponseCache();
    window.dispatchEvent(new Event("storage"));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem("token");
    clearApiResponseCache();
    window.dispatchEvent(new Event("storage"));
  } catch {
    /* ignore */
  }
}

// Session-scoped API response cache (see communityApi.ts). Cleared whenever the
// signed-in identity changes so user A's cached responses can't leak to user B.
// Inlined (not imported from communityApi) to avoid a circular dependency:
// communityApi -> session -> communityApi.
function clearApiResponseCache() {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith("sportstathub:api:")) doomed.push(key);
    }
    doomed.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

export function isAuthed(): boolean {
  return getSessionUser() !== null;
}

/** Clear the httpOnly cookie server-side, then drop the local descriptor. */
export async function logout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
  } catch {
    /* network error — still clear local state */
  }
  clearSession();
}
