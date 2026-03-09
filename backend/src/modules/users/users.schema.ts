import { z } from 'zod';

const dominantHandSchema = z.enum(['RIGHT', 'LEFT']);

export const updateMeSchema = z
  .object({
    displayName: z.string().min(1).max(100).optional(),
    dominantHand: dominantHandSchema.nullable().optional(),
    handicap: z.number().min(-10).max(60).nullable().optional(),
    goals: z.string().max(2000).nullable().optional()
  })
  .refine((value: Record<string, unknown>) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided'
  });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
