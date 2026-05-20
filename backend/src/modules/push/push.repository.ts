import { prisma } from '../../infrastructure/prisma/client.js';

type UpsertSubscriptionData = {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
};

export const pushRepository = {
  async upsertSubscription(data: UpsertSubscriptionData) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: {
        userId: data.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent ?? null
      },
      update: {
        userId: data.userId,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent ?? null
      }
    });
  },

  async deleteSubscription(userId: string, endpoint: string) {
    const existing = await prisma.pushSubscription.findFirst({
      where: { endpoint, userId },
      select: { id: true }
    });
    if (!existing) return false;
    await prisma.pushSubscription.delete({ where: { id: existing.id } });
    return true;
  },

  async deleteSubscriptionByEndpoint(endpoint: string) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  },

  async findByUserId(userId: string) {
    return prisma.pushSubscription.findMany({ where: { userId } });
  }
};
