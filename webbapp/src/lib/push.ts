// Web Push utilities — client-side only.
// All functions guard against SSR by checking `typeof window`.

const SW_SCRIPT = '/sw.js';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export type CanUsePushResult =
  | { supported: true; needsInstall: false }
  | { supported: false; needsInstall: true; reason: 'ios-needs-install' }
  | { supported: false; needsInstall: false; reason: string };

/**
 * Detects whether the current browser/device can receive Web Push.
 *
 * - iOS Safari in a regular tab: reports needsInstall=true so the UI shows an
 *   "Add to Home Screen" prompt instead of trying to subscribe.
 * - iOS PWA (standalone): supported.
 * - Android / Desktop: supported as long as SW + PushManager are available.
 */
export function canUsePush(): CanUsePushResult {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, needsInstall: false, reason: 'ssr' };
  }

  if (!('serviceWorker' in navigator)) {
    return { supported: false, needsInstall: false, reason: 'no-service-worker' };
  }

  if (!('PushManager' in window)) {
    // On iOS the PushManager is only present in standalone (PWA) mode.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      return { supported: false, needsInstall: true, reason: 'ios-needs-install' };
    }
    return { supported: false, needsInstall: false, reason: 'no-push-manager' };
  }

  // PushManager exists — verify we're not on iOS Safari in a browser tab.
  // On iOS 16.4+ PushManager is defined only in standalone mode, but guard anyway.
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);

  if (isIos && !isStandalone) {
    return { supported: false, needsInstall: true, reason: 'ios-needs-install' };
  }

  return { supported: true, needsInstall: false };
}

// ---------------------------------------------------------------------------
// VAPID public key
// ---------------------------------------------------------------------------

let cachedVapidKey: string | null = null;

async function fetchVapidPublicKey(): Promise<string> {
  if (cachedVapidKey) return cachedVapidKey;

  // Derive the API base URL from Next.js env — fall back to localhost for dev.
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  const res = await fetch(`${apiBase}/push/vapid-public-key`);
  if (!res.ok) throw new Error('Failed to fetch VAPID public key');
  const data = (await res.json()) as { publicKey: string };
  cachedVapidKey = data.publicKey;
  return cachedVapidKey;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buf = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i);
  }
  return view;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(SW_SCRIPT, { scope: '/' });
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type PushStatus = 'subscribed' | 'denied' | 'unsupported' | 'available';

export async function getPushStatus(): Promise<PushStatus> {
  const check = canUsePush();
  if (!check.supported) return 'unsupported';

  if (Notification.permission === 'denied') return 'denied';

  try {
    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'available';
  } catch {
    return 'unsupported';
  }
}

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

export async function subscribeToPush(): Promise<void> {
  const check = canUsePush();
  if (!check.supported) {
    throw new Error(check.reason ?? 'Push not supported');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  const vapidPublicKey = await fetchVapidPublicKey();
  const reg = await getRegistration();

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) throw new Error('Invalid push subscription keys');

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;

  const res = await fetch(`${apiBase}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ endpoint: subscription.endpoint, keys: { p256dh, auth } })
  });

  if (!res.ok) throw new Error('Failed to save push subscription');
}

// ---------------------------------------------------------------------------
// Unsubscribe
// ---------------------------------------------------------------------------

export async function unsubscribeFromPush(): Promise<void> {
  const check = canUsePush();
  if (!check.supported) return;

  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;

  // Best-effort — don't throw if the backend call fails
  await fetch(`${apiBase}/push/subscribe`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ endpoint })
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Token helper — reads from the same localStorage key as tokenStorage.ts
// ---------------------------------------------------------------------------

function getStoredAccessToken(): string | null {
  try {
    const raw = window.localStorage.getItem('golftrainer.auth.tokens');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}
