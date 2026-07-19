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

export interface ActiveSession {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  current: boolean;
}

export async function listActiveSessions(): Promise<ActiveSession[]> {
  const res = await fetch(`${API_BASE}/auth/sessions`, { credentials: 'include' });
  if (!res.ok) throw new Error('Could not load active sessions');
  const json = await res.json();
  return json.data ?? [];
}

export async function revokeActiveSession(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE', credentials: 'include',
  });
  if (!res.ok && res.status !== 404) throw new Error('Could not revoke session');
}

export async function revokeOtherSessions(): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/sessions`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error('Could not revoke other sessions');
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw) as SessionUser;
    return parsed&&(parsed.id||parsed.email||parsed.username)?parsed:null;
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

type SessionCheck = { state: 'ok'; user: SessionUser } | { state: 'unauthorized' | 'forbidden' | 'network' | 'server' };

async function fetchMe(): Promise<SessionCheck> {
  try {
    const res = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
    if (res.status === 401) return { state: 'unauthorized' };
    if (res.status === 403) return { state: 'forbidden' };
    if (!res.ok) return { state: 'server' };
    const json = await res.json();
    return { state: 'ok', user: (json.data ?? json) as SessionUser };
  } catch {
    return { state: 'network' };
  }
}

/** Silently exchange the refresh-token cookie for a new access-token cookie. */
async function performRefresh(): Promise<'ok' | 'unauthorized' | 'concurrent' | 'network' | 'server'> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    if (res.ok) return 'ok';
    if (res.status === 401) return 'unauthorized';
    if (res.status === 409) return 'concurrent';
    return 'server';
  } catch {
    return 'network';
  }
}

let refreshPromise: Promise<ReturnType<typeof performRefresh> extends Promise<infer T> ? T : never> | null = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  const run = async () => {
    // The Web Locks API coordinates all tabs. Recheck the access cookie through
    // /api/me after acquiring the lock because another tab may have refreshed.
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks) return locks.request('sportstathub-session-refresh', async () => {
      const current = await fetchMe();
      if (current.state === 'ok') return 'ok' as const;
      const result = await performRefresh();
      if (result === 'ok') {
        const channel = new BroadcastChannel('sportstathub-session');
        channel.postMessage({ type: 'refreshed' });
        channel.close();
      }
      return result;
    });
    return performRefresh();
  };
  refreshPromise = run().finally(() => { refreshPromise = null; });
  return refreshPromise;
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

  let check = await fetchMe();
  if (check.state === 'unauthorized') {
    const refreshed = await refreshAccessToken();
    if (refreshed === 'ok' || refreshed === 'concurrent') check = await fetchMe();
    else if (refreshed === 'unauthorized') { clearSession(); return; }
    else return; // offline/5xx must not destroy a potentially valid session
  }
  if (check.state === 'network' || check.state === 'server') return;
  if (check.state !== 'ok') {
    clearSession();
    return;
  }
  const me = check.user;

  // Only touch storage (and clear the API cache / fire the storage event)
  // when something actually changed — a no-op sync shouldn't wipe caches
  // that other tabs/components are relying on every few minutes.
  const changed = current.id !== me.id || current.role !== me.role || current.email !== me.email;
  if (changed) setSessionUser(me);
}
