export const ADMIN_TOKEN_KEY = "token";
export const ADMIN_COOKIE_NAME = "admin_token";

export interface JwtPayload {
  id?: number | string;
  email?: string;
  username?: string;
  role?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)) as JwtPayload;
  } catch {
    return null;
  }
}

export function isAdminPayload(payload: JwtPayload | null): payload is JwtPayload {
  if (!payload || payload.role !== "admin") return false;
  if (payload.exp && payload.exp * 1000 < Date.now()) return false;
  return true;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function storeAdminToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);

  const payload = decodeJwt(token);
  const maxAge = payload?.exp
    ? Math.max(0, Math.floor(payload.exp - Date.now() / 1000))
    : 60 * 60;

  document.cookie = `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/admin; Max-Age=${maxAge}; SameSite=Lax`;
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  document.cookie = `${ADMIN_COOKIE_NAME}=; Path=/admin; Max-Age=0; SameSite=Lax`;
}

export function getStoredUser(): JwtPayload | null {
  const token = getStoredToken();
  if (!token) return null;
  return decodeJwt(token);
}
