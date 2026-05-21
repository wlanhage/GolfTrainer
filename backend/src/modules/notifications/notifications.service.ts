import { NotFoundError } from '../../common/errors/AppError.js';
import { notificationsRepository } from './notifications.repository.js';
import type { NotificationType } from '@prisma/client';

export const notificationsService = {
  list(userId: string, opts: { unreadOnly: boolean; limit: number; offset: number }) {
    return notificationsRepository.listForUser(userId, opts);
  },

  async unreadCount(userId: string) {
    const count = await notificationsRepository.unreadCount(userId);
    return { count };
  },

  async markRead(notificationId: string, userId: string) {
    const ok = await notificationsRepository.markRead(notificationId, userId);
    if (!ok) throw new NotFoundError('Notification not found');
  },

  markAllRead(userId: string) {
    return notificationsRepository.markAllRead(userId);
  },

  notifyRoundStarted(invitedUserIds: string[], hostName: string, courseName: string, roundId: string) {
    if (invitedUserIds.length === 0) return Promise.resolve({ count: 0 });
    return notificationsRepository.createManyForUsers(invitedUserIds, {
      type: 'ROUND_STARTED' satisfies NotificationType,
      title: 'Rundan har börjat',
      body: `${hostName} har startat en runda på ${courseName}. Gå med och fyll i dina scores.`,
      url: `/play/round/${roundId}/1`
    });
  }
};
