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
  },

  notifyNewFollower(followedUserId: string, followerName: string, followerUserId: string) {
    return notificationsRepository.create({
      userId: followedUserId,
      type: 'NEW_FOLLOWER',
      title: 'Ny följare',
      body: `${followerName} började följa dig.`,
      url: `/u/${followerUserId}`
    });
  },

  notifyFriendStartedRound(
    followerUserIds: string[],
    friendName: string,
    friendUserId: string,
    courseName: string
  ) {
    if (followerUserIds.length === 0) return Promise.resolve({ count: 0 });
    return notificationsRepository.createManyForUsers(followerUserIds, {
      type: 'FRIEND_STARTED_ROUND',
      title: 'En vän har börjat spela',
      body: `${friendName} startade en runda på ${courseName}.`,
      url: `/u/${friendUserId}`
    });
  },

  notifyFriendFinishedNotable(
    followerUserIds: string[],
    friendName: string,
    friendUserId: string,
    courseName: string,
    relativeToPar: number
  ) {
    if (followerUserIds.length === 0) return Promise.resolve({ count: 0 });
    const sign = relativeToPar > 0 ? `+${relativeToPar}` : String(relativeToPar);
    return notificationsRepository.createManyForUsers(followerUserIds, {
      type: 'FRIEND_FINISHED_NOTABLE',
      title: 'Bra runda av en vän',
      body: `${friendName} avslutade på ${courseName}: ${sign} mot par — spelade till sin HCP.`,
      url: `/u/${friendUserId}`
    });
  },

  notifyPersonalBest(userId: string, courseName: string, relativeToPar: number, roundId: string) {
    const sign = relativeToPar > 0 ? `+${relativeToPar}` : String(relativeToPar);
    return notificationsRepository.create({
      userId,
      type: 'PERSONAL_BEST',
      title: 'Personligt rekord!',
      body: `Du slog ditt rekord på ${courseName}: ${sign} mot par.`,
      url: `/play/round/${roundId}/overview`
    });
  }
};
