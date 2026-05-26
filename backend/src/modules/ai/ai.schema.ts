import { z } from 'zod';

export const caddyChatSchema = z.object({
  message: z.string().min(1).max(2000),
  roundId: z.string().optional(),
});

export type CaddyChatInput = z.infer<typeof caddyChatSchema>;

export const clubRecommendSchema = z.object({
  imageBase64: z.string().min(1),
  distanceToGreenFront: z.number().optional(),
  distanceToGreenMiddle: z.number().optional(),
  distanceToGreenBack: z.number().optional(),
  holeNumber: z.number().int().min(1).max(18).optional(),
  par: z.number().int().optional(),
  roundId: z.string().optional(),
});
export type ClubRecommendInput = z.infer<typeof clubRecommendSchema>;

export const dataClubRecommendSchema = z.object({
  distanceToGreenFront: z.number().optional(),
  distanceToGreenMiddle: z.number().optional(),
  distanceToGreenBack: z.number().optional(),
  holeNumber: z.number().int().min(1).max(18).optional(),
  par: z.number().int().optional(),
  roundId: z.string().optional(),
});
export type DataClubRecommendInput = z.infer<typeof dataClubRecommendSchema>;
