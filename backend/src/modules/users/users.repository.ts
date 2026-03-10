import { prisma } from '../../infrastructure/prisma/client.js';
import type { UpdateMeInput } from './users.schema.js';

export const usersRepository = {
  getMe(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId },
      include: { profile: true }
    });
  },

  upsertProfile(userId: string, input: UpdateMeInput) {
    return prisma.userProfile.upsert({
      where: { userId },
      update: input,
      create: {
        ...input,
        userId,
        displayName: input.displayName ?? 'Golfer'
      }
    });
  }
};
