import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE_NAME = "token";
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
      headers: { Cookie: `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}` },
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
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const apiOrigin = new URL(API_BASE).origin;
  const scriptPolicy = isDev
    // Next's development runtime injects framework diagnostics that do not all
    // receive the request nonce. This branch is never emitted in production.
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const csp = [
    "default-src 'self'",
    scriptPolicy,
    // The current UI uses React style props and CSS variables. Script execution
    // remains nonce-only; style attributes are the sole documented exception.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://media.api-sports.io https://media-3.api-sports.io https://media-4.api-sports.io",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const finalize = (response: NextResponse) => {
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return response;
  };

  if (!pathname.startsWith('/admin')) {
    return finalize(NextResponse.next({ request: { headers: requestHeaders } }));
  }
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.has(pathname);
  const hasAdminSession = await hasValidAdminSession(request.cookies.get(ADMIN_COOKIE_NAME)?.value);

  if (!isPublicAdminPath && !hasAdminSession) {
    const url = new URL("/admin/login", request.url);
    if (pathname !== "/admin") url.searchParams.set("next", pathname);
    return finalize(NextResponse.redirect(url));
  }

  if (isPublicAdminPath && hasAdminSession) {
    return finalize(NextResponse.redirect(new URL("/admin", request.url)));
  }

  return finalize(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: [{
    source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
    missing: [
      { type: 'header', key: 'next-router-prefetch' },
      { type: 'header', key: 'purpose', value: 'prefetch' },
    ],
  }],
};
