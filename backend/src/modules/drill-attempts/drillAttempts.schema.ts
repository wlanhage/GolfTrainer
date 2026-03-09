import { z } from 'zod';

export const attemptIdParamSchema = z.object({ attemptId: z.string().cuid() });

export const createDrillAttemptSchema = z.object({
  drillId: z.string().cuid(),
  practiceSessionId: z.string().cuid().optional(),
  successfulAttempts: z.number().int().min(0),
  totalAttempts: z.number().int().positive(),
  score: z.number().optional(),
  notes: z.string().max(2000).optional(),
  attemptedAt: z.coerce.date().optional()
}).refine((v) => v.successfulAttempts <= v.totalAttempts, {
  message: 'successfulAttempts must be <= totalAttempts',
  path: ['successfulAttempts']
});

export const updateDrillAttemptSchema = z.object({
  successfulAttempts: z.number().int().min(0).optional(),
  totalAttempts: z.number().int().positive().optional(),
  score: z.number().nullable().optional(),
  notes: z.string().max(2000).optional(),
  attemptedAt: z.coerce.date().optional()
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });
