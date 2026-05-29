import { z } from 'zod';

export const recipientIdParamSchema = z.object({
  recipientId: z.string().min(1)
});

export const sendMessageBodySchema = z.object({
  content: z.string().min(1).max(2000)
});

export const chatPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().optional()
});
