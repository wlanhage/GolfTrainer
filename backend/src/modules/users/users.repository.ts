import { prisma } from '../../infrastructure/prisma/client.js';

export const usersRepository = {
  getMe(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId },
      include: { profile: true }
    });
  }
};
