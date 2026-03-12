import { prisma } from '../../infrastructure/prisma/client.js';

export const drillsRepository = {
  create(userId: string, data: { name: string; description?: string; metricType: 'SUCCESS_RATE' | 'DISTANCE_CONTROL' | 'DISPERSION' | 'STROKES' | 'TIME_BASED'; isPublic?: boolean }) {
    return prisma.drill.create({ data: { userId, ...data } });
  },
  listVisible(userId: string) {
    return prisma.drill.findMany({
      where: {
        OR: [{ userId }, { isPublic: true }]
      },
      orderBy: { createdAt: 'desc' }
    });
  },
  listAll() {
    return prisma.drill.findMany({ orderBy: { createdAt: 'desc' } });
  },
  createAsAdmin(data: { userId?: string; name: string; description?: string; metricType: 'SUCCESS_RATE' | 'DISTANCE_CONTROL' | 'DISPERSION' | 'STROKES' | 'TIME_BASED'; isPublic?: boolean }) {
    return prisma.drill.create({ data });
  },
  getById(id: string) {
    return prisma.drill.findUnique({ where: { id } });
  },
  getVisibleById(userId: string, id: string) {
    return prisma.drill.findFirst({ where: { id, OR: [{ userId }, { isPublic: true }] } });
  },
  updateOwned(userId: string, id: string, data: Record<string, unknown>) {
    return prisma.drill.updateMany({ where: { id, userId }, data });
  },
  updateById(id: string, data: Record<string, unknown>) {
    return prisma.drill.update({ where: { id }, data });
  },
  deleteOwned(userId: string, id: string) {
    return prisma.drill.deleteMany({ where: { id, userId } });
  },
  deleteById(id: string) {
    return prisma.drill.delete({ where: { id } });
  }
};
