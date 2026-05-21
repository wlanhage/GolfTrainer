// Fallback-deklaration för web-push. @types/web-push ligger i dependencies
// men om Render's build-cache snubblar på det (har hänt 2 ggr) faller bygget
// tillbaka på denna shim istället för att krascha.

declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }

  export interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  export interface WebPushError extends Error {
    statusCode?: number;
    body?: string;
    headers?: Record<string, string>;
    endpoint?: string;
  }

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: Record<string, unknown>
  ): Promise<SendResult>;
}
