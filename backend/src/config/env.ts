import dotenv from 'dotenv';
import { z } from 'zod';

const envFile = process.env.ENV_FILE?.trim();

dotenv.config(envFile ? { path: envFile } : undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  // Komma-separerad lista med tillåtna frontend-origins i produktion.
  // Ex: "https://golftrainer.vercel.app,https://golftrainer-admin.vercel.app"
  CORS_ORIGINS: z.string().optional(),
  // Web Push / VAPID — generera engångsvis med: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional()
});

export const env = envSchema.parse(process.env);

export const allowedOriginsFromEnv = (): string[] =>
  env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0)
    : [];
