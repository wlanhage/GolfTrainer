import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../../../shared/api/config';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
};

type Credentials = {
  email: string;
  password: string;
};

async function withTimeout(input: RequestInfo, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export const authApi = {
  async login(input: Credentials): Promise<AuthResponse> {
    const response = await withTimeout(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    return response.json() as Promise<AuthResponse>;
  },

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const response = await withTimeout(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      throw new Error('Refresh failed');
    }

    return response.json() as Promise<AuthResponse>;
  },

  async logout(refreshToken: string): Promise<void> {
    await withTimeout(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
  }
};
