import { prisma } from '../../infrastructure/prisma/client.js';
import type { NotificationType } from '@prisma/client';

export const notificationsRepository = {
  create(data: { userId: string; type: NotificationType; title: string; body: string; url?: string | null }) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        url: data.url ?? null
      }
    });
  },

  createManyForUsers(
    userIds: string[],
    payload: { type: NotificationType; title: string; body: string; url?: string | null }
  ) {
    if (userIds.length === 0) return Promise.resolve({ count: 0 });
    return prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        url: payload.url ?? null
      }))
    });
  },

  listForUser(userId: string, opts: { unreadOnly: boolean; limit: number; offset: number }) {
    return prisma.notification.findMany({
      where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: opts.limit,
      skip: opts.offset
    });
  },

  unreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, readAt: null } });
  },

  async markRead(notificationId: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() }
    });
    return result.count > 0;
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() }
    });
  }
};
