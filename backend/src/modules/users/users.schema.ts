import { z } from 'zod';

const dominantHandSchema = z.enum(['RIGHT', 'LEFT']);
const userRoleSchema = z.enum(['BASIC_USER', 'USER', 'PREMIUM_USER', 'ADMIN']);

export const updateMeSchema = z
  .object({
    displayName: z.string().min(1).max(100).optional(),
    homeClub: z.string().max(120).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    country: z.string().max(120).nullable().optional(),
    dominantHand: dominantHandSchema.nullable().optional(),
    handicap: z.number().min(-10).max(60).nullable().optional(),
    targetHandicap: z.number().min(-10).max(60).nullable().optional(),
    skillLevel: z.string().max(60).nullable().optional(),
    yearsPlaying: z.number().int().min(0).max(100).nullable().optional(),
    roundsLast12Months: z.number().int().min(0).max(500).nullable().optional(),
    trainingDaysPerWeek: z.number().int().min(0).max(7).nullable().optional(),
    favoriteClub: z.string().max(120).nullable().optional(),
    strengthArea: z.string().max(300).nullable().optional(),
    focusArea: z.string().max(300).nullable().optional(),
    goals: z.string().max(2000).nullable().optional()
  })
  .refine((value: Record<string, unknown>) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided'
  });

export const adminUpdateUserSchema = z
  .object({
    email: z.string().email().optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
    displayName: z.string().min(1).max(100).nullable().optional(),
    homeClub: z.string().max(120).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    country: z.string().max(120).nullable().optional()
  })
  .refine((value: Record<string, unknown>) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided'
  });

export const userIdParamSchema = z.object({ userId: z.string().cuid() });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
