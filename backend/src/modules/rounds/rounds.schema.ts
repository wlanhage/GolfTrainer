import { z } from 'zod';

export const roundIdParamSchema = z.object({
  roundId: z.string().cuid()
});

export const roundHoleParamSchema = z.object({
  roundId: z.string().cuid(),
  holeNumber: z.coerce.number().int().min(1).max(36)
});

export const roundFormatEnum = z.enum([
  'STROKE_PLAY',
  'STABLEFORD',
  'BEST_BALL_TEAM',
  'BEST_BALL_2V2',
  'FFA_STROKE',
  'FFA_STABLEFORD',
  'WOLF'
]);

export const createRoundPlayerSchema = z.object({
  userId: z.string().cuid(),
  team: z.string().trim().max(8).nullable().optional()
});

export const createRoundSchema = z.object({
  courseId: z.string().cuid(),
  format: roundFormatEnum.optional(),
  players: z.array(createRoundPlayerSchema).min(1).max(8).optional()
});

export const playerScoreParamSchema = z.object({
  roundId: z.string().cuid(),
  holeNumber: z.coerce.number().int().min(1).max(36),
  playerId: z.string().cuid()
});

export const updatePlayerScoreSchema = z
  .object({
    strokes: z.number().int().min(0).max(30).nullable().optional(),
    wolfRole: z.enum(['WOLF', 'PARTNER', 'OPPONENT']).nullable().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided'
  });

// Watch companion: set the calling player's strokes on a hole (by holeNumber).
export const updateStrokesSchema = z.object({
  strokes: z.number().int().min(0).max(30)
});
export type UpdateStrokesInput = z.infer<typeof updateStrokesSchema>;

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
    notes: z.string().max(2000).nullable().optional(),
    completedAt: z.coerce.date().nullable().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided'
  });

export const setRoundImageSchema = z.object({
  image: z.string().min(1).max(2_000_000)
});

export const listRoundsQuerySchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type CreateRoundPlayerInput = z.infer<typeof createRoundPlayerSchema>;
export type UpdateRoundInput = z.infer<typeof updateRoundSchema>;
export type UpdateRoundHoleInput = z.infer<typeof updateRoundHoleSchema>;
export type UpdatePlayerScoreInput = z.infer<typeof updatePlayerScoreSchema>;
export type ListRoundsQuery = z.infer<typeof listRoundsQuerySchema>;
export type SetRoundImageInput = z.infer<typeof setRoundImageSchema>;
export type RoundFormatValue = z.infer<typeof roundFormatEnum>;

export const createRoundShotSchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  clubId: z.string().min(1),
  fromLat: z.number(),
  fromLng: z.number(),
  toLat: z.number().optional(),
  toLng: z.number().optional(),
});
export type CreateRoundShotInput = z.infer<typeof createRoundShotSchema>;

export const roundShotIdParamSchema = z.object({
  roundId: z.string().min(1),
  shotId: z.string().min(1),
});

// Utvalda emojis man kan reagera med på en runda. Måste hållas i synk med
// REACTION_EMOJIS i webbappens RoundReactions-komponent.
export const ROUND_REACTION_EMOJIS = ['👏', '🔥', '⛳', '💪', '😂'] as const;

export const setRoundReactionSchema = z.object({
  emoji: z.enum(ROUND_REACTION_EMOJIS)
});
export type SetRoundReactionInput = z.infer<typeof setRoundReactionSchema>;
