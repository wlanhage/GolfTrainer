import { prisma } from '../../infrastructure/prisma/client.js';

export const shotsRepository = {
  create(userId: string, data: {
    practiceSessionId?: string;
    drillAttemptId?: string;
    userClubId: string;
    carryMeters?: number;
    totalMeters?: number;
    launchDirectionDeg?: number;
    curveDeg?: number;
    lieType?: string;
    resultTag?: string;
    notes?: string;
    recordedAt: Date;
  }) {
    return prisma.shotEntry.create({ data: { userId, ...data } });
  },
  list(userId: string) {
    return prisma.shotEntry.findMany({ where: { userId }, orderBy: { recordedAt: 'desc' } });
  },
  getById(userId: string, id: string) {
    return prisma.shotEntry.findFirst({ where: { id, userId } });
  },
  update(userId: string, id: string, data: Record<string, unknown>) {
    return prisma.shotEntry.updateMany({ where: { id, userId }, data });
  },
  delete(userId: string, id: string) {
    return prisma.shotEntry.deleteMany({ where: { id, userId } });
  },
  getOwnedClub(userId: string, clubId: string) {
    return prisma.userClub.findFirst({ where: { id: clubId, userId } });
  },
  getOwnedSession(userId: string, sessionId: string) {
    return prisma.practiceSession.findFirst({ where: { id: sessionId, userId } });
  },
  getOwnedAttempt(userId: string, attemptId: string) {
    return prisma.drillAttempt.findFirst({ where: { id: attemptId, userId } });
  }
};
