import { prisma } from '../../infrastructure/prisma/client.js';
import { CADDY_RESULT_TAG } from '../caddy/caddy.constants.js';
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
      role?: 'USER' | 'PREMIUM_USER' | 'ADMIN';
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
  },

  searchByDisplayName(query: string, viewerUserId: string, limit: number) {
    return prisma.user.findMany({
      where: {
        isActive: true,
        NOT: { id: viewerUserId },
        profile: {
          is: {
            displayName: { contains: query, mode: 'insensitive' }
          }
        }
      },
      include: {
        profile: {
          select: {
            displayName: true,
            avatarImage: true,
            homeClub: true,
            handicap: true,
            dominantHand: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  },

  getPublicProfile(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, isActive: true },
      include: {
        profile: {
          select: {
            displayName: true,
            avatarImage: true,
            homeClub: true,
            handicap: true,
            dominantHand: true
          }
        }
      }
    });
  },

  async getTopCaddyClubLabel(userId: string): Promise<string | null> {
    const grouped = await prisma.shotEntry.groupBy({
      by: ['userClubId'],
      where: { userId, resultTag: CADDY_RESULT_TAG },
      _count: { _all: true },
      orderBy: { _count: { userClubId: 'desc' } },
      take: 1
    });

    const topGroup = grouped[0];
    if (!topGroup) return null;

    const club = await prisma.userClub.findUnique({
      where: { id: topGroup.userClubId },
      select: { label: true }
    });

    return club?.label ?? null;
  },

  async getMyStats(userId: string) {
    const [favoriteClub, longestDriveRow, totalCaddyShots, missionsGrouped, user] = await Promise.all([
      this.getTopCaddyClubLabel(userId),
      prisma.shotEntry.findFirst({
        where: {
          userId,
          resultTag: CADDY_RESULT_TAG,
          userClub: { label: 'Driver' }
        },
        orderBy: { carryMeters: 'desc' },
        select: { carryMeters: true }
      }),
      prisma.shotEntry.count({ where: { userId, resultTag: CADDY_RESULT_TAG } }),
      prisma.missionEntry.groupBy({
        by: ['missionTemplateId'],
        where: { userId },
        _count: { _all: true }
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })
    ]);

    const missionsCompleted = missionsGrouped.length;
    const totalMissionEntries = missionsGrouped.reduce((sum, m) => sum + m._count._all, 0);

    return {
      favoriteClub,
      longestDriveMeters: longestDriveRow?.carryMeters ? Number(longestDriveRow.carryMeters) : null,
      totalCaddyShots,
      missionsCompleted,
      totalMissionEntries,
      memberSince: user?.createdAt ?? null
    };
  }
};
