import { z } from 'zod';

export const inviteCodeParamSchema = z.object({
  code: z.string().min(8).max(64)
});

export const joinAsGuestSchema = z.object({
  name: z.string().min(2).max(40)
});
