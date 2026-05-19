import { z } from 'zod';

export const roundIdParamSchema = z.object({
  roundId: z.string().cuid()
});

export const roundHoleParamSchema = z.object({
  roundId: z.string().cuid(),
  holeNumber: z.coerce.number().int().min(1).max(36)
});

export const createRoundSchema = z.object({
  courseId: z.string().cuid()
});

export const updateRoundSchema = z
  .object({
    currentHoleNumber: z.number().int().min(1).max(36).optional(),
    status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED']).optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided'
  });

export const updateRoundHoleSchema = z
  .object({
    strokes: z.number().int().min(0).max(30).nullable().optional(),
    notes: z.string().max(2000).nullable().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided'
  });

export const listRoundsQuerySchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type UpdateRoundInput = z.infer<typeof updateRoundSchema>;
export type UpdateRoundHoleInput = z.infer<typeof updateRoundHoleSchema>;
export type ListRoundsQuery = z.infer<typeof listRoundsQuerySchema>;
