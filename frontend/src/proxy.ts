import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE_NAME = "token";
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/admin/register"]);
// Public origin — this is what the BROWSER connects to, so it must stay the
// real public URL (used below for the CSP connect-src directive).
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
// Server-to-server origin for the fetch this proxy itself makes. Calling the
// public URL from inside the frontend container means routing back out to
// the internet and back in through Traefik just to reach a sibling
// container — a hairpin path that's fragile/blocked in some Docker/VPS
// networking setups and previously caused every /admin/* request to hang.
// INTERNAL_API_URL points at the backend's Docker service DNS name instead
// (see docker-compose.prod.yml), falling back to the public URL for local dev
// where there's no internal service name to resolve.
const INTERNAL_API_BASE = process.env.INTERNAL_API_URL ?? API_BASE;

// Confirms the session with the backend (which verifies the JWT signature via
// fastify.jwtVerify) rather than trusting a locally base64-decoded payload —
// decoding alone doesn't prove the token was actually signed by the server,
// so anyone could set an `admin_token` cookie shaped like
// `x.<base64 of {"role":"admin"}>.x` and walk straight past this gate.
async function hasValidAdminSession(token?: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(`${INTERNAL_API_BASE}/api/me`, {
      headers: { Cookie: `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}` },
      cache: "no-store",
      // Never let a stalled/unreachable backend hang every admin page load.
      signal: AbortSignal.timeout(5_000),
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
