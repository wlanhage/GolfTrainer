import { z } from 'zod';

export const pairPollSchema = z.object({
  deviceSecret: z.string().min(16)
});

export const pairClaimSchema = z.object({
  code: z.string().trim().min(4).max(12)
});

export type PairPollInput = z.infer<typeof pairPollSchema>;
export type PairClaimInput = z.infer<typeof pairClaimSchema>;
