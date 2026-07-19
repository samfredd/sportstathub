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

async function fetchMe(): Promise<SessionUser | null> {
  try {
    const res = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? json) as SessionUser;
  } catch {
    return null;
  }
}

/** Silently exchange the refresh-token cookie for a new access-token cookie. */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Re-validate the local "logged in" descriptor against the server.
 *
 * Without this, the localStorage descriptor has no TTL of its own: once the
 * access-token cookie expires server-side, the UI (Navbar, bottom bar, etc.)
 * would otherwise keep showing "signed in" forever, since nothing ever tells
 * it to stop. This confirms the session is still good — silently renewing it
 * via the refresh-token cookie first if the access token has expired — and
 * clears the stale descriptor (flipping every "storage"-event listener to
 * logged-out) only once both are confirmed gone.
 *
 * Call this periodically (see SessionSync) rather than on every render.
 */
export async function syncSession(): Promise<void> {
  if (typeof window === "undefined") return;
  const current = getSessionUser();
  if (!current) return; // nothing to sync if we don't think we're logged in

  let me = await fetchMe();
  if (!me) {
    const refreshed = await refreshAccessToken();
    if (refreshed) me = await fetchMe();
  }

  if (!me) {
    clearSession();
    return;
  }

  // Only touch storage (and clear the API cache / fire the storage event)
  // when something actually changed — a no-op sync shouldn't wipe caches
  // that other tabs/components are relying on every few minutes.
  const changed = current.id !== me.id || current.role !== me.role || current.email !== me.email;
  if (changed) setSessionUser(me);
}
