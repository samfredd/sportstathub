import fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import rawBody from "fastify-raw-body";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import config from "./src/config/env.config.js";
import infrastructure from "./src/config/db.js";
import scheduler from "./src/plugins/scheduler.js";
import observability from "./src/plugins/observability.js";
import authenticate from "./src/plugins/authenticate.js";
// requireAdmin.ts is intentionally not imported: authenticate.ts already
// decorates requireAdmin with the full user-loading version (checks DB status,
// loads subscription). The weaker plugin is dead code — never register it.
import authRoutes from "./src/modules/auth/auth.routes.js";
import oauthRoutes from "./src/modules/auth/oauth.routes.js";
import footballRoutes from "./src/modules/football/football.routes.js";
import codesRoutes from "./src/modules/codes/codes.routes.js";
import refereesRoutes from "./src/modules/referees/referees.routes.js";
import adminRoutes    from "./src/modules/admin/admin.routes.js";
import adminInvitationRoutes from "./src/modules/admin/admin-invitations.routes.js";
import contactRoutes  from "./src/modules/contact/contact.routes.js";
import communityRoutes from "./src/modules/community/community.routes.js";
import oddsRoutes from "./src/modules/odds/odds.routes.js";
import aiRoutes   from "./src/modules/ai/ai.routes.js";
import newsRoutes  from "./src/modules/news/news.routes.js";
import billingRoutes from "./src/modules/billing/billing.routes.js";

const isProd = process.env.NODE_ENV === "production";
const trustedProxyAddresses = new Set(
  (process.env.TRUSTED_PROXY_ADDRESSES || '127.0.0.1,::1')
    .split(',').map((value) => value.trim()).filter(Boolean),
);

const server = fastify({
  // Behind Traefik (TLS termination) the backend only ever receives forwarded
  // requests, so trust X-Forwarded-* — without this Fastify treats every request
  // as internal http, which breaks https detection, secure cookies, and the
  // Google OAuth state/PKCE cookie round-trip on the callback.
  trustProxy: (address) => trustedProxyAddresses.has(address),
  logger: isProd
    ? { level: process.env.LOG_LEVEL ?? "warn" }
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:mm:ss:ms",
            ignore: "pid,hostname",
          },
        },
      },
});

server.setErrorHandler((error: any, request, reply) => {
  // Guard: rate-limit's errorResponseBuilder already sent 429 — if we try to
  // send again Fastify throws "FST_ERR_REP_ALREADY_SENT" which becomes 500.
  if (reply.sent) return;

  // Only accept numeric HTTP status codes — error.status can be the string
  // "error" on some plugin errors, which crashes reply.status().
  const raw = error.statusCode ?? error.status;
  const statusCode = (typeof raw === 'number' && raw >= 100 && raw < 600) ? raw : 500;
  request.log.error({ err: error }, error.message);
  if (statusCode >= 500) {
    return reply.status(500).send({ status: "error", error: "Internal Server Error" });
  }
  return reply.status(statusCode).send({ status: "error", error: error.message });
});

// OpenAPI spec — register before routes so Fastify collects schemas as routes load.
// Serves /openapi.json; /docs renders the Swagger UI (dev + staging only).
await server.register(swagger, {
  openapi: {
    openapi: "3.0.0",
    info: {
      title: "SportStatHub API",
      description: "Football analytics platform — fixtures, standings, H2H, predictions",
      version: "1.0.0",
    },
  },
});
if (!isProd) {
  await server.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", filter: true },
  });
}

// Infrastructure (DB + Redis) — must be first
await server.register(infrastructure);
await server.register(observability);

// Security headers — HSTS, X-Content-Type-Options, X-Frame-Options, etc.
// CSP is disabled here: this is a JSON API (no HTML/inline scripts to protect);
// the Content-Security-Policy belongs on the Next.js frontend that serves markup.
await server.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
});

// Cookie support — registered globally so JWT can be read from an httpOnly
// cookie and login/logout can set/clear it. Must come before @fastify/jwt.
await server.register(cookie);

// Raw body capture — must be registered before routes so the Paystack webhook
// handler can verify HMAC-SHA512 against the exact bytes Paystack signed.
await server.register(rawBody, {
  field: 'rawBody',   // adds request.rawBody as Buffer
  global: false,      // opt-in per route via config.rawBody = true
  encoding: false,    // keep as Buffer (not string)
  runFirst: true,     // run before other parsers
  routes: ['/api/billing/paystack/webhook'],
});

// Rate limiting — global default, auth routes override to a tighter window
await server.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip ?? 'unknown',
  // No custom errorResponseBuilder: the plugin throws a proper Error(429) which
  // our setErrorHandler converts to { status:'error', error:'...' } correctly.
});

// Security — allow the configured origin plus its 127.0.0.1 / localhost twin
// so the browser works whether the dev server is opened via localhost or 127.0.0.1.
const corsOrigins = new Set([
  config.corsOrigin,
  config.corsOrigin.replace('localhost', '127.0.0.1'),
  config.corsOrigin.replace('127.0.0.1', 'localhost'),
].filter(Boolean));

await server.register(cors, {
  origin: (origin, cb) => {
    if (!origin || corsOrigins.has(origin)) return cb(null, true);
    cb(Object.assign(new Error('Not allowed by CORS'), { statusCode: 403 }), false);
  },
  credentials: true, // allow the browser to send the httpOnly auth cookie
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

await server.register(fastifyJwt, {
  secret: config.secretKey,
  sign: { expiresIn: config.jwtExpiration, algorithm: "HS256" },
  // Read the token from the httpOnly cookie first; the Authorization header
  // still works as a fallback (backward compatible during the migration).
  cookie: { cookieName: "token", signed: false },
});

// Auth decorators (depend on JWT)
await server.register(authenticate);

// Background jobs — subscription expiry sweep + prediction settlement
await server.register(scheduler);

// Feature routes
await server.register(authRoutes);
await server.register(oauthRoutes);
await server.register(footballRoutes);
await server.register(codesRoutes);
await server.register(refereesRoutes);
await server.register(adminRoutes);
await server.register(adminInvitationRoutes);
await server.register(contactRoutes);
await server.register(communityRoutes);
await server.register(oddsRoutes);
await server.register(aiRoutes);
await server.register(newsRoutes);
await server.register(billingRoutes);

// Stable machine-readable contract endpoint used by CI and client generation.
// Swagger UI remains available only outside production.
server.get('/openapi.json', { schema: { hide: true } }, async () => server.swagger());

server.get("/health/live", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
}));

server.get("/health/ready", async (_request, reply) => {
  try {
    await Promise.all([
      (server as any).db.query('SELECT 1'),
      server.redis.ping(),
    ]);
    return { status: 'ready', timestamp: new Date().toISOString() };
  } catch (error) {
    server.log.warn({ err: error }, 'Readiness dependency check failed');
    return reply.status(503).send({ status: 'not_ready' });
  }
});

// Backward-compatible aggregate health route.
server.get("/health", async (_request, reply) => {
  try {
    await Promise.all([(server as any).db.query('SELECT 1'), server.redis.ping()]);
    return { status: 'ok', timestamp: new Date().toISOString() };
  } catch { return reply.status(503).send({ status: 'not_ready' }); }
});

try {
  await server.listen({ port: config.port, host: config.host });
} catch (error: any) {
  server.log.error({ err: error }, "Failed to start server");
  process.exit(1);
}
