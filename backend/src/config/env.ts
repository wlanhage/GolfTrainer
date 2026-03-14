import dotenv from 'dotenv';
import { z } from 'zod';

const envFile = process.env.ENV_FILE?.trim();

dotenv.config(envFile ? { path: envFile } : undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d')
});

export const env = envSchema.parse(process.env);
