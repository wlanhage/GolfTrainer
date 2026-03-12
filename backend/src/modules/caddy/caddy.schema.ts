import { z } from 'zod';
import { CADDY_CLUB_KEY_SET } from './caddy.constants.js';

export const caddyClubParamsSchema = z.object({
  clubKey: z.string().refine((key) => CADDY_CLUB_KEY_SET.has(key), 'Invalid club key')
});

export const caddyShotIdParamsSchema = z.object({
  shotId: z.string().cuid()
});

export const caddyTargetQuerySchema = z.object({
  userId: z.string().cuid().optional()
});

export const createCaddyShotSchema = z.object({
  distanceMeters: z.number().positive(),
  lateralOffsetMeters: z.number(),
  peakHeightMeters: z.number().positive().optional(),
  spinRpm: z.number().positive().optional(),
  recordedAt: z.coerce.date().optional()
});
