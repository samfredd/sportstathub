import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE_NAME = "admin_token";
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/admin/register"]);

function decodePayload(token: string): { role?: string; exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

function isAdminToken(token?: string) {
  if (!token) return false;
  const payload = decodePayload(token);
  if (payload?.role !== "admin") return false;
  if (payload.exp && payload.exp * 1000 < Date.now()) return false;
  return true;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.has(pathname);
  const hasAdminSession = isAdminToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value);

  if (!isPublicAdminPath && !hasAdminSession) {
    const url = new URL("/admin/login", request.url);
    if (pathname !== "/admin") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isPublicAdminPath && hasAdminSession) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
