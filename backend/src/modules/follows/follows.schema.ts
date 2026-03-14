import { z } from 'zod';

export const targetUserParamSchema = z.object({
  targetUserId: z.string().cuid()
});

export const profileUserParamSchema = z.object({
  userId: z.string().cuid()
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export const followedCourseLeaderboardQuerySchema = paginationQuerySchema.extend({
  courseId: z.string().cuid()
});
