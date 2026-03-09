import { prisma } from '../../infrastructure/prisma/client.js';

export const clubsRepository = {
  create(userId: string, data: { clubCatalogId?: string; label: string; isActive?: boolean }) {
    return prisma.userClub.create({ data: { userId, ...data } });
  },
  list(userId: string) {
    return prisma.userClub.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  },
  getById(userId: string, id: string) {
    return prisma.userClub.findFirst({ where: { id, userId } });
  },
  update(userId: string, id: string, data: { clubCatalogId?: string; label?: string; isActive?: boolean }) {
    return prisma.userClub.updateMany({ where: { id, userId }, data });
  },
  delete(userId: string, id: string) {
    return prisma.userClub.deleteMany({ where: { id, userId } });
  }
};
