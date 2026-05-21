import fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";

import config from "./src/config/env.config.js";
import infrastructure from "./src/config/db.js";
import authenticate from "./src/plugins/authenticate.js";
import requireAdmin from "./src/plugins/requireAdmin.js";
import authRoutes from "./src/modules/auth/auth.routes.js";
import oauthRoutes from "./src/modules/auth/oauth.routes.js";
import footballRoutes from "./src/modules/football/football.routes.js";
import codesRoutes from "./src/modules/codes/codes.routes.js";
import refereesRoutes from "./src/modules/referees/referees.routes.js";
import adminRoutes    from "./src/modules/admin/admin.routes.js";
import contactRoutes  from "./src/modules/contact/contact.routes.js";
import communityRoutes from "./src/modules/community/community.routes.js";
import oddsRoutes from "./src/modules/odds/odds.routes.js";
import aiRoutes   from "./src/modules/ai/ai.routes.js";
import newsRoutes  from "./src/modules/news/news.routes.js";
import billingRoutes from "./src/modules/billing/billing.routes.js";

const isProd = process.env.NODE_ENV === "production";

const server = fastify({
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
  const statusCode = error.statusCode || error.status || 500;
  request.log.error({ err: error }, error.message);
  if (statusCode >= 500) {
    return reply.status(500).send({ status: "error", error: "Internal Server Error" });
  }
  return reply.status(statusCode).send({ status: "error", error: error.message });
});

// Infrastructure (DB + Redis) — must be first
await server.register(infrastructure);

// Security
await server.register(cors, {
  origin: config.corsOrigin,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

await server.register(fastifyJwt, {
  secret: config.secretKey,
  sign: { expiresIn: config.jwtExpiration, algorithm: "HS256" },
});

// Auth decorators (depend on JWT)
await server.register(authenticate);
await server.register(requireAdmin);

// Feature routes
await server.register(authRoutes);
await server.register(oauthRoutes);
await server.register(footballRoutes);
await server.register(codesRoutes);
await server.register(refereesRoutes);
await server.register(adminRoutes);
await server.register(contactRoutes);
await server.register(communityRoutes);
await server.register(oddsRoutes);
await server.register(aiRoutes);
await server.register(newsRoutes);
await server.register(billingRoutes);

server.get("/health", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
  redis: server.redis.status,
}));

try {
  await server.listen({ port: config.port, host: config.host });
} catch (error: any) {
  server.log.error({ err: error }, "Failed to start server");
  process.exit(1);
}
