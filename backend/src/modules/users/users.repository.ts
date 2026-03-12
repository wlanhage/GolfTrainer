import { prisma } from '../../infrastructure/prisma/client.js';
import type { UpdateMeInput } from './users.schema.js';

export const usersRepository = {
  getById(userId: string) {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  getMe(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId },
      include: { profile: true }
    });
  },

  listAllUsers() {
    return prisma.user.findMany({
      include: { profile: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  updateUserById(
    userId: string,
    input: {
      email?: string;
      role?: 'BASIC_USER' | 'USER' | 'PREMIUM_USER' | 'ADMIN';
      isActive?: boolean;
      displayName?: string | null;
      homeClub?: string | null;
      city?: string | null;
      country?: string | null;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      if (input.email !== undefined || input.role !== undefined || input.isActive !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            email: input.email,
            role: input.role,
            isActive: input.isActive
          }
        });
      }

      if (
        input.displayName !== undefined ||
        input.homeClub !== undefined ||
        input.city !== undefined ||
        input.country !== undefined
      ) {
        await tx.userProfile.upsert({
          where: { userId },
          update: {
            displayName: input.displayName ?? undefined,
            homeClub: input.homeClub,
            city: input.city,
            country: input.country
          },
          create: {
            userId,
            displayName: input.displayName ?? 'Golfer',
            homeClub: input.homeClub,
            city: input.city,
            country: input.country
          }
        });
      }

      return tx.user.findUnique({ where: { id: userId }, include: { profile: true } });
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
