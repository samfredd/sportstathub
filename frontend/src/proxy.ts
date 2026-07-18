import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE_NAME = "admin_token";
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/admin/register"]);
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Confirms the session with the backend (which verifies the JWT signature via
// fastify.jwtVerify) rather than trusting a locally base64-decoded payload —
// decoding alone doesn't prove the token was actually signed by the server,
// so anyone could set an `admin_token` cookie shaped like
// `x.<base64 of {"role":"admin"}>.x` and walk straight past this gate.
async function hasValidAdminSession(token?: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.data?.role === "admin";
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.has(pathname);
  const hasAdminSession = await hasValidAdminSession(request.cookies.get(ADMIN_COOKIE_NAME)?.value);

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
