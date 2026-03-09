import { z } from 'zod';

export const drillIdParamSchema = z.object({ drillId: z.string().cuid() });
const metricType = z.enum(['SUCCESS_RATE', 'DISTANCE_CONTROL', 'DISPERSION', 'STROKES', 'TIME_BASED']);

export const createDrillSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(2000).optional(),
  metricType,
  isPublic: z.boolean().optional().default(false)
});

export const updateDrillSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).optional(),
  metricType: metricType.optional(),
  isPublic: z.boolean().optional()
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });
