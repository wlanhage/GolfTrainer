import { NotFoundError } from '../../common/errors/AppError.js';
import { notificationsRepository } from './notifications.repository.js';
import { pushService } from '../push/push.service.js';
import type { NotificationType } from '@prisma/client';

/**
 * Single source of truth for delivering a notification to a user.
 * Every notify* helper below funnels through here so in-app + push
 * are always in sync — no more "bell ticked but phone never lit up".
 *
 * Push is fire-and-forget; if it fails (VAPID missing, stale subscription,
 * etc.) we never want to block the in-app insert. Errors are swallowed
 * — pushService already logs them internally and prunes stale subs.
 */
async function deliver(
  userIds: string[],
  payload: { type: NotificationType; title: string; body: string; url: string }
) {
  if (userIds.length === 0) return { count: 0 };

  // 1. In-app (bell icon) — durable, must succeed.
  const result =
    userIds.length === 1
      ? await notificationsRepository.create({ userId: userIds[0], ...payload })
      : await notificationsRepository.createManyForUsers(userIds, payload);

  // 2. Push (OS notification) — fire-and-forget. Sent in parallel for speed.
  void Promise.allSettled(
    userIds.map((userId) =>
      pushService.sendPushToUser(userId, {
        title: payload.title,
        body: payload.body,
        url: payload.url
      })
    )
  );

  return result;
}

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
    return deliver(invitedUserIds, {
      type: 'ROUND_STARTED',
      title: 'Rundan har börjat',
      body: `${hostName} har startat en runda på ${courseName}. Gå med och fyll i dina scores.`,
      url: `/play/round/${roundId}/1`
    });
  },

  notifyNewFollower(followedUserId: string, followerName: string, followerUserId: string) {
    return deliver([followedUserId], {
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
    return deliver(followerUserIds, {
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
    const sign = relativeToPar > 0 ? `+${relativeToPar}` : String(relativeToPar);
    return deliver(followerUserIds, {
      type: 'FRIEND_FINISHED_NOTABLE',
      title: 'Bra runda av en vän',
      body: `${friendName} avslutade på ${courseName}: ${sign} mot par — spelade till sin HCP.`,
      url: `/u/${friendUserId}`
    });
  },

  notifyPersonalBest(userId: string, courseName: string, relativeToPar: number, roundId: string) {
    const sign = relativeToPar > 0 ? `+${relativeToPar}` : String(relativeToPar);
    return deliver([userId], {
      type: 'PERSONAL_BEST',
      title: 'Personligt rekord!',
      body: `Du slog ditt rekord på ${courseName}: ${sign} mot par.`,
      url: `/play/round/${roundId}/overview`
    });
  },

  /**
   * Chat: push-only (no in-app row). The message itself is already stored
   * in chat_messages and the unread count is derived from that — we don't
   * want to also bloat the notifications table with a row per message.
   */
  notifyChatMessage(recipientUserId: string, senderName: string, senderUserId: string, preview: string) {
    void pushService
      .sendPushToUser(recipientUserId, {
        title: senderName,
        body: preview.length > 80 ? preview.slice(0, 77) + '…' : preview,
        url: `/community/chat/${senderUserId}`
      })
      .catch(() => undefined);
  }
};
