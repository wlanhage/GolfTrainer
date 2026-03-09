import { prisma } from '../../infrastructure/prisma/client.js';

export const drillAttemptsRepository = {
  create(userId: string, data: { drillId: string; practiceSessionId?: string; successCount: number; attemptCount: number; score?: number; notes?: string; attemptedAt?: Date }) {
    return prisma.drillAttempt.create({ data: { userId, ...data } });
  },
  list(userId: string) {
    return prisma.drillAttempt.findMany({ where: { userId }, orderBy: { attemptedAt: 'desc' } });
  },
  getById(userId: string, id: string) {
    return prisma.drillAttempt.findFirst({ where: { id, userId } });
  },
  update(userId: string, id: string, data: Record<string, unknown>) {
    return prisma.drillAttempt.updateMany({ where: { id, userId }, data });
  },
  delete(userId: string, id: string) {
    return prisma.drillAttempt.deleteMany({ where: { id, userId } });
  },
  userOwnsDrill(userId: string, drillId: string) {
    return prisma.drill.findFirst({ where: { id: drillId, OR: [{ userId }, { isPublic: true }] } });
  },
  userOwnsSession(userId: string, sessionId: string) {
    return prisma.practiceSession.findFirst({ where: { id: sessionId, userId } });
  }
};
