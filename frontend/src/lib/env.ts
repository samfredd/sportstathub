import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  AI_SERVICE_URL: z.string().url().optional(),
});

export const serverEnv = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  AI_SERVICE_URL: process.env.AI_SERVICE_URL,
});
