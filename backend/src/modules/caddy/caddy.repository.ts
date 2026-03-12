import { prisma } from '../../infrastructure/prisma/client.js';
import { CADDY_RESULT_TAG } from './caddy.constants.js';

export const caddyRepository = {
  findUserClubByLabel(userId: string, label: string) {
    return prisma.userClub.findFirst({ where: { userId, label } });
  },

  createUserClub(userId: string, label: string) {
    return prisma.userClub.create({ data: { userId, label, isActive: true } });
  },

  createShot(userId: string, input: {
    userClubId: string;
    distanceMeters: number;
    lateralOffsetMeters: number;
    peakHeightMeters?: number;
    spinRpm?: number;
    recordedAt: Date;
  }) {
    const notes = JSON.stringify({
      source: CADDY_RESULT_TAG,
      peakHeightMeters: input.peakHeightMeters,
      spinRpm: input.spinRpm
    });

    return prisma.shotEntry.create({
      data: {
        userId,
        userClubId: input.userClubId,
        carryMeters: input.distanceMeters,
        curveDeg: input.lateralOffsetMeters,
        notes,
        resultTag: CADDY_RESULT_TAG,
        recordedAt: input.recordedAt
      }
    });
  },

  listShotsByUser(userId: string) {
    return prisma.shotEntry.findMany({
      where: { userId, resultTag: CADDY_RESULT_TAG },
      orderBy: { recordedAt: 'desc' },
      include: { userClub: { select: { label: true } } }
    });
  },

  listShotsForClub(userId: string, userClubId: string) {
    return prisma.shotEntry.findMany({
      where: { userId, userClubId, resultTag: CADDY_RESULT_TAG },
      orderBy: { recordedAt: 'desc' }
    });
  },

  getShotById(userId: string, shotId: string) {
    return prisma.shotEntry.findFirst({ where: { id: shotId, userId, resultTag: CADDY_RESULT_TAG } });
  },

  deleteShot(userId: string, shotId: string) {
    return prisma.shotEntry.deleteMany({ where: { id: shotId, userId, resultTag: CADDY_RESULT_TAG } });
  }
};
