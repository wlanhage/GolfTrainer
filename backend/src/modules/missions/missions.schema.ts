import { z } from 'zod';

export const missionIdParamSchema = z.object({ missionId: z.string().cuid() });

const scoreInputType = z.enum(['STEPPER', 'MANUAL_NUMBER']);
const missionStatus = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

const missionFieldsSchema = z.object({
  slug: z.string().min(2).max(120),
  name: z.string().min(2).max(120),
  description: z.string().min(2).max(2000),
  icon: z.string().min(1).max(8),
  objective: z.string().min(2).max(300),
  scoreLabel: z.string().min(1).max(60),
  scoreInputType,
  stepperMin: z.number().int().optional(),
  stepperMax: z.number().int().optional(),
  defaultScore: z.number().optional(),
  maxScore: z.number().optional(),
  status: missionStatus.optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  leaderboardTitle: z.string().max(120).optional(),
  leaderboardActive: z.boolean().optional()
});

export const adminCreateMissionSchema = missionFieldsSchema.superRefine((value, ctx) => {
  if (value.scoreInputType === 'STEPPER' && value.stepperMax == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['stepperMax'],
      message: 'stepperMax is required when scoreInputType is STEPPER'
    });
  }
});

export const adminUpdateMissionSchema = missionFieldsSchema.partial().refine((v: Record<string, unknown>) => Object.keys(v).length > 0, {
  message: 'At least one field must be provided'
});
