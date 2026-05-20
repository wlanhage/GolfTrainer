import webpush from 'web-push';
import { env } from '../../config/env.js';
import { BadRequestError } from '../../common/errors/AppError.js';
import { pushRepository } from './push.repository.js';

// Lazily initialise VAPID — keys may be absent in test/dev environments.
let vapidInitialised = false;

function ensureVapid() {
  if (vapidInitialised) return;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new BadRequestError('Web Push not configured: VAPID keys missing');
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidInitialised = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export const pushService = {
  getVapidPublicKey() {
    if (!env.VAPID_PUBLIC_KEY) {
      throw new BadRequestError('Web Push not configured: VAPID public key missing');
    }
    return env.VAPID_PUBLIC_KEY;
  },

  async subscribe(userId: string, endpoint: string, p256dh: string, auth: string, userAgent?: string | null) {
    return pushRepository.upsertSubscription({ userId, endpoint, p256dh, auth, userAgent });
  },

  async unsubscribe(userId: string, endpoint: string) {
    return pushRepository.deleteSubscription(userId, endpoint);
  },

  async sendPushToUser(userId: string, payload: PushPayload) {
    ensureVapid();
    const subscriptions = await pushRepository.findByUserId(userId);
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body
          );
        } catch (err) {
          const webPushErr = err as { statusCode?: number };
          // 404 / 410 means the subscription is stale — remove it
          if (webPushErr.statusCode === 404 || webPushErr.statusCode === 410) {
            await pushRepository.deleteSubscriptionByEndpoint(sub.endpoint).catch(() => undefined);
          }
        }
      })
    );
  }
};
