import { z } from 'zod';

export const shotIdParamSchema = z.object({ shotId: z.string().cuid() });

export const createShotSchema = z.object({
  practiceSessionId: z.string().cuid().optional(),
  drillAttemptId: z.string().cuid().optional(),
  userClubId: z.string().cuid(),
  carryMeters: z.number().nonnegative().optional(),
  totalMeters: z.number().nonnegative().optional(),
  launchDirectionDeg: z.number().optional(),
  curveDeg: z.number().optional(),
  lieType: z.string().max(40).optional(),
  resultTag: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  recordedAt: z.coerce.date()
});

export const updateShotSchema = createShotSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'At least one field must be provided'
});
