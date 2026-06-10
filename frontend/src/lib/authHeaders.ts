import { isAuthed } from "./session";

/**
 * Auth is carried by an httpOnly cookie the browser sends automatically, so we
 * no longer attach an Authorization header (the JWT isn't readable from JS).
 * These helpers keep their original names/signatures so existing call sites work
 * unchanged — `withAuth` now just opts the request into sending cookies.
 */

export function getAuthHeaders(): Record<string, string> {
  return {};
}

export function hasAuthToken(): boolean {
  return isAuthed();
}

export function withAuth(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    credentials: "include", // send the httpOnly auth cookie cross-origin
    headers: {
      ...(init.headers as Record<string, string> | undefined),
    },
  };
}
