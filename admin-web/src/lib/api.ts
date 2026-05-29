import { AdminRound, ClubDistance, Mission, User } from './types';
import { tokenStorage, type AuthTokens } from './tokenStorage';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
// 45s tolerates Render free-tier cold-starts.
const TIMEOUT_MS = 45_000;

// ─── Auth API (unauthenticated calls) ──────────────────────────────────────────

async function timedFetch(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthTokens> {
    const res = await timedFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message ?? 'Inloggning misslyckades');
    }
    return res.json() as Promise<AuthTokens>;
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const res = await timedFetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (!res.ok) throw new Error('Refresh failed');
    return res.json() as Promise<AuthTokens>;
  },

  async logout(refreshToken: string): Promise<void> {
    await timedFetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    }).catch(() => undefined); // best-effort; don't block UI
  }
};

// ─── Refresh-aware request client ─────────────────────────────────────────────
//
// We use a single shared refresh promise so that concurrent requests that all
// hit 401 at the same time only trigger ONE refresh call. Subsequent requests
// wait for that single promise and then retry with the new token.

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const tokens = tokenStorage.load();
  if (!tokens?.refreshToken) return null;
  try {
    const next = await authApi.refresh(tokens.refreshToken);
    tokenStorage.save(next);
    return next.accessToken;
  } catch {
    // Refresh token is expired or revoked — hard logout.
    tokenStorage.clear();
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
    return null;
  }
}

async function getNewAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function performRequest<T>(
  path: string,
  options: RequestInit,
  accessToken: string | null
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    // Only set Content-Type when there's actually a body — Fastify rejects
    // empty-body requests that claim application/json.
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined)
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
      signal: controller.signal
    });

    if (!res.ok && res.status !== 401) {
      const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
    }

    const data: T = res.status === 204 ? (null as T) : await res.json();
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tokens = tokenStorage.load();
  const first = await performRequest<T>(path, options, tokens?.accessToken ?? null);

  if (first.status !== 401) {
    return first.data;
  }

  // Access token expired — try to refresh once, then retry.
  const newToken = await getNewAccessToken();
  if (!newToken) {
    // getNewAccessToken already redirected to /login.
    throw new Error('Unauthorized');
  }

  const second = await performRequest<T>(path, options, newToken);
  if (second.status === 401) {
    // Refresh succeeded but the retry is still 401 (e.g. admin role revoked).
    tokenStorage.clear();
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
    throw new Error('Unauthorized');
  }

  return second.data;
}

// ─── Typed API surface ─────────────────────────────────────────────────────────

export const api = {
  tokenStorage,

  async login(email: string, password: string): Promise<AuthTokens> {
    const tokens = await authApi.login(email, password);
    tokenStorage.save(tokens);
    return tokens;
  },

  async logout(): Promise<void> {
    const tokens = tokenStorage.load();
    if (tokens?.refreshToken) {
      await authApi.logout(tokens.refreshToken);
    }
    tokenStorage.clear();
  },

  async me() {
    return request<{ user: { id: string; email: string } }>('/users/me');
  },

  async listUsers() {
    // Backend route: GET /users/  (admin-only, declared in users.routes.ts).
    // Returns the array directly, not wrapped.
    return request<User[]>('/users');
  },

  async updateUser(userId: string, payload: Partial<User>) {
    // Backend route: PATCH /users/:userId  (admin-only).
    return request<User>(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async adminRoundStats() {
    return request<{
      users: { total: number; active: number; admins: number };
      rounds: { inProgress: number; completed: number; abandoned: number; total: number };
    }>('/rounds/admin/stats');
  },

  async adminListRounds(opts: { status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (opts.status) params.set('status', opts.status);
    params.set('limit', String(opts.limit ?? 20));
    params.set('offset', String(opts.offset ?? 0));
    return request<{ rounds: AdminRound[] }>(`/rounds/admin?${params.toString()}`).then((r) => r.rounds);
  },

  async listMissions() {
    return request<{ missions: Mission[] }>('/missions/admin').then((res) => res.missions);
  },

  async createMission(payload: Partial<Mission>) {
    return request<{ mission: Mission }>('/missions/admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    }).then((res) => res.mission);
  },

  async updateMission(missionId: string, payload: Partial<Mission>) {
    return request<{ mission: Mission }>(`/missions/admin/${missionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }).then((res) => res.mission);
  },

  async deleteMission(missionId: string) {
    return request<{ ok: boolean }>(`/missions/admin/${missionId}`, { method: 'DELETE' });
  },

  async caddyClubs() {
    return request<{ clubs: ClubDistance[] }>('/caddy/clubs').then((res) => res.clubs);
  }
};
