import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const notificationIdParamSchema = z.object({
  notificationId: z.string().cuid()
});
