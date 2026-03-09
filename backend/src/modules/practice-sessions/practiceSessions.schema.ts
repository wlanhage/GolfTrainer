import { z } from 'zod';

export const sessionIdParamSchema = z.object({ sessionId: z.string().cuid() });

export const createSessionSchema = z.object({
  title: z.string().max(100).optional(),
  focusArea: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional()
});

export const updateSessionSchema = z.object({
  title: z.string().max(100).optional(),
  focusArea: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  startedAt: z.coerce.date().optional(),
  endedAt: z.coerce.date().nullable().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ABANDONED']).optional()
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });
