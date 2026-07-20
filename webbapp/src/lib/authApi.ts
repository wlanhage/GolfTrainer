import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
};

async function timedFetch(input: RequestInfo, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export const authApi = {
  async register(input: { email: string; password: string; displayName: string }): Promise<AuthResponse> {
    const res = await timedFetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!res.ok) {
      // Låt UI:t skilja på "e-post upptagen" (409) och övriga fel
      const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
      throw new Error(body?.error?.code === 'CONFLICT' || res.status === 409 ? 'EMAIL_TAKEN' : 'REGISTRATION_FAILED');
    }
    return res.json();
  },
  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const res = await timedFetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },
  async refresh(refreshToken: string): Promise<AuthResponse> {
    const res = await timedFetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (!res.ok) throw new Error('Refresh failed');
    return res.json();
  },
  async logout(refreshToken: string): Promise<void> {
    await timedFetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
  }
};
