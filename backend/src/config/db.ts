import fp from "fastify-plugin";
import fastifyPostgres from "@fastify/postgres";
import fastifyRedis from "@fastify/redis";
import config from "./env.config.js";

async function infrastructurePlugin(fastify: any, opts: any = {}) {
  // --- 1. POSTGRESQL SETUP ---
  const pgOpts = {
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    retries: 10,
    baseDelayMs: 500,
    maxDelayMs: 10_000,
    ...opts.pg
  };

  await fastify.register(fastifyPostgres, pgOpts);

  // Exponential backoff + jitter for DB startup
  const waitForDb = async () => {
    for (let attempt = 1; attempt <= pgOpts.retries; attempt++) {
      let client;
      try {
        client = await fastify.pg.connect();
        await client.query("SELECT 1");
        fastify.log.info({ attempt }, "PostgreSQL: Connection verified");
        return;
      } catch (err: any) {
        const delay = Math.min(
          pgOpts.maxDelayMs,
          pgOpts.baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250)
        );
        fastify.log.warn(
          { err: err.message, attempt, nextDelayMs: delay },
          "PostgreSQL: Not ready, retrying..."
        );
        if (attempt === pgOpts.retries) throw new Error("Postgres unreachable");
        await new Promise((r) => setTimeout(r, delay));
      } finally {
        if (client) client.release();
      }
    }
  };

  if (process.env.NODE_ENV !== 'test') await waitForDb();

  // Decorate with helpers
  fastify.decorate("db", {
    query: (text: string, params?: unknown[]) => fastify.pg.query(text, params),
    transact: (fn: any) => fastify.pg.transact(fn),
    connect: () => fastify.pg.connect(),
  });

  // --- 2. REDIS SETUP ---

  await fastify.register(fastifyRedis, { host: config.redisHost, port: config.redisPort, password: config.redisPassword });

  const { redis } = fastify;

  // Connection Event Listeners
  redis.on('connect', () => fastify.log.info('Redis: TCP connected'));
  redis.on('ready', () => fastify.log.info('Redis: Authenticated and Ready'));
  redis.on('error', (err) => fastify.log.error(`Redis: Error - ${err.message}`));
  redis.on('end', () => fastify.log.warn('Redis: Connection closed'));

  // Final System Check
  fastify.addHook('onReady', async () => {
    fastify.log.info(`System Check: Redis status is "${redis.status}"`);
  });
}

const infrastructure = fp(infrastructurePlugin, {
  name: "infrastructure",
  fastify: "5.x",
});

export default infrastructure;
