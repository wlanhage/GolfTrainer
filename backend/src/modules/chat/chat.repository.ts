import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/client.js';

export const chatRepository = {
  createMessage(senderId: string, recipientId: string, content: string) {
    return prisma.chatMessage.create({
      data: { senderId, recipientId, content }
    });
  },

  async getMessages(userA: string, userB: string, limit: number, beforeId?: string) {
    const cursor = beforeId ? { id: beforeId } : undefined;
    return prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userA, recipientId: userB },
          { senderId: userB, recipientId: userA }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor, skip: 1 } : {})
    });
  },

  async listConversations(userId: string) {
    const rows = await prisma.$queryRaw<Array<{
      partnerId: string;
      partnerDisplayName: string;
      partnerAvatarImage: string | null;
      lastMessageContent: string;
      lastMessageAt: Date;
      lastMessageSenderId: string;
      unreadCount: bigint;
    }>>(Prisma.sql`
      WITH ranked AS (
        SELECT
          CASE WHEN cm."senderId" = ${userId} THEN cm."recipientId" ELSE cm."senderId" END AS "partnerId",
          cm.content AS "lastMessageContent",
          cm."createdAt" AS "lastMessageAt",
          cm."senderId" AS "lastMessageSenderId",
          ROW_NUMBER() OVER (
            PARTITION BY CASE WHEN cm."senderId" = ${userId} THEN cm."recipientId" ELSE cm."senderId" END
            ORDER BY cm."createdAt" DESC
          ) AS rn
        FROM chat_messages cm
        WHERE cm."senderId" = ${userId} OR cm."recipientId" = ${userId}
      )
      SELECT
        r."partnerId",
        COALESCE(up."displayName", u.email) AS "partnerDisplayName",
        up."avatarImage" AS "partnerAvatarImage",
        r."lastMessageContent",
        r."lastMessageAt",
        r."lastMessageSenderId",
        (
          SELECT COUNT(*)::bigint FROM chat_messages cm2
          WHERE cm2."recipientId" = ${userId}
            AND cm2."senderId" = r."partnerId"
            AND cm2."readAt" IS NULL
        ) AS "unreadCount"
      FROM ranked r
      JOIN "User" u ON u.id = r."partnerId"
      LEFT JOIN "UserProfile" up ON up."userId" = u.id
      WHERE r.rn = 1
      ORDER BY r."lastMessageAt" DESC
    `);

    return rows.map((r: typeof rows[number]) => ({
      ...r,
      unreadCount: Number(r.unreadCount),
      lastMessageAt: r.lastMessageAt.toISOString()
    }));
  },

  markConversationRead(recipientId: string, senderId: string) {
    return prisma.chatMessage.updateMany({
      where: { recipientId, senderId, readAt: null },
      data: { readAt: new Date() }
    });
  },

  async hasExistingConversation(userA: string, userB: string): Promise<boolean> {
    const msg = await prisma.chatMessage.findFirst({
      where: {
        OR: [
          { senderId: userA, recipientId: userB },
          { senderId: userB, recipientId: userA }
        ]
      },
      select: { id: true }
    });
    return msg !== null;
  },

  totalUnreadCount(userId: string) {
    return prisma.chatMessage.count({
      where: { recipientId: userId, readAt: null }
    });
  }
};
