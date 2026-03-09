import { z } from 'zod';

export const rangeQuerySchema = z.object({
  rangeDays: z.coerce.number().int().positive().max(365).default(30)
});

export const trendQuerySchema = z.object({
  rangeDays: z.coerce.number().int().positive().max(90).default(30)
});
