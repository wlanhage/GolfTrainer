import { z } from 'zod';

export const subscribeBodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

export const unsubscribeBodySchema = z.object({
  endpoint: z.string().url()
});

export type SubscribeBody = z.infer<typeof subscribeBodySchema>;
export type UnsubscribeBody = z.infer<typeof unsubscribeBodySchema>;
