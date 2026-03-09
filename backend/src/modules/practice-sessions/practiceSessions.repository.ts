import { prisma } from '../../infrastructure/prisma/client.js';

export const practiceSessionsRepository = {
  create(userId: string, data: { title?: string; focusArea?: string; notes?: string; startedAt: Date; endedAt?: Date }) {
    return prisma.practiceSession.create({ data: { userId, ...data } });
  },
  list(userId: string) {
    return prisma.practiceSession.findMany({ where: { userId }, orderBy: { startedAt: 'desc' } });
  },
  getById(userId: string, id: string) {
    return prisma.practiceSession.findFirst({ where: { id, userId } });
  },
  update(userId: string, id: string, data: Record<string, unknown>) {
    return prisma.practiceSession.updateMany({ where: { id, userId }, data });
  },
  delete(userId: string, id: string) {
    return prisma.practiceSession.deleteMany({ where: { id, userId } });
  }
};
