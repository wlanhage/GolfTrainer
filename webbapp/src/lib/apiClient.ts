import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';

type Requester = {
  getAccessToken: () => Promise<string | null>;
  onUnauthorized: () => Promise<string | null>;
};

export class ApiClient {
  constructor(private readonly requester: Requester) {}

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const first = await this.perform<T>(path, init, await this.requester.getAccessToken());

    if (first.status !== 401) {
      return first.data;
    }

    const nextToken = await this.requester.onUnauthorized();
    if (!nextToken) {
      throw new Error('Unauthorized');
    }

    const second = await this.perform<T>(path, init, nextToken);
    if (second.status === 401) {
      throw new Error('Unauthorized');
    }

    return second.data;
  }

  private async perform<T>(path: string, init: RequestInit | undefined, token: string | null) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined)
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers,
        signal: controller.signal
      });

      if (!response.ok && response.status !== 401) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = response.status === 204 ? null : await response.json();
      return { status: response.status, data: data as T };
    } finally {
      clearTimeout(timeout);
    }
  }
}
