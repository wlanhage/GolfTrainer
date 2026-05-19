import { z } from 'zod';

export const missionIdParamSchema = z.object({ missionId: z.string().cuid() });

const scoreInputType = z.enum(['STEPPER', 'MANUAL_NUMBER']);
const scoreDirection = z.enum(['ASC', 'DESC']);
const missionStatus = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

const slugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, digits, and hyphens');

const missionFieldsSchema = z.object({
  slug: slugSchema,
  name: z.string().min(2).max(120),
  description: z.string().min(2).max(2000),
  icon: z.string().min(1).max(8),
  objective: z.string().min(2).max(300),
  scoreLabel: z.string().min(1).max(60),
  scoreInputType,
  scoreDirection: scoreDirection.optional(),
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

const validateMissionFields = (
  value: z.infer<typeof missionFieldsSchema>,
  ctx: z.RefinementCtx
) => {
  if (value.scoreInputType === 'STEPPER' && value.stepperMax == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['stepperMax'],
      message: 'stepperMax is required when scoreInputType is STEPPER'
    });
  }
  if (
    value.scoreInputType === 'STEPPER' &&
    value.stepperMin != null &&
    value.stepperMax != null &&
    value.stepperMin > value.stepperMax
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['stepperMin'],
      message: 'stepperMin cannot exceed stepperMax'
    });
  }
  if (
    value.scoreInputType === 'STEPPER' &&
    value.defaultScore != null &&
    ((value.stepperMin != null && value.defaultScore < value.stepperMin) ||
      (value.stepperMax != null && value.defaultScore > value.stepperMax))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['defaultScore'],
      message: 'defaultScore must be within [stepperMin, stepperMax]'
    });
  }
  if (value.startsAt && value.endsAt && new Date(value.startsAt) >= new Date(value.endsAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'endsAt must be after startsAt'
    });
  }
};

export const adminCreateMissionSchema = missionFieldsSchema.superRefine(validateMissionFields);

export const adminUpdateMissionSchema = missionFieldsSchema
  .partial()
  .refine((v: Record<string, unknown>) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided'
  })
  .superRefine((value, ctx) => validateMissionFields(value as z.infer<typeof missionFieldsSchema>, ctx));

export const submitMissionEntrySchema = z.object({
  score: z.number().finite(),
  notes: z.string().max(2000).optional()
});
