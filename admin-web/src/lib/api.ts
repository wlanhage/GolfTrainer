import { ClubDistance, Mission, User } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

const tokenStorage = {
  get: () => (typeof window === 'undefined' ? null : window.localStorage.getItem('gt_admin_token')),
  set: (token: string) => typeof window !== 'undefined' && window.localStorage.setItem('gt_admin_token', token),
  clear: () => typeof window !== 'undefined' && window.localStorage.removeItem('gt_admin_token')
};

export async function request<T>(path: string, options: RequestInit = {}, withAuth = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (withAuth) {
    const token = tokenStorage.get();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: 'no-store' });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(payload?.error?.message ?? `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  tokenStorage,
  request,
  async login(email: string, password: string) {
    const payload = await request<{ accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }, false);
    tokenStorage.set(payload.accessToken);
    return payload;
  },
  async me() {
    return request<{ user: { id: string; email: string } }>('/users/me');
  },
  async listUsers() {
    return request<{ users: User[] }>('/users/admin/list').then((res) => res.users);
  },
  async updateUser(userId: string, payload: Partial<User>) {
    return request<{ user: User }>(`/users/admin/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) }).then((res) => res.user);
  },
  async listMissions() {
    return request<{ missions: Mission[] }>('/missions/admin').then((res) => res.missions);
  },
  async createMission(payload: Partial<Mission>) {
    return request<{ mission: Mission }>('/missions/admin', { method: 'POST', body: JSON.stringify(payload) }).then((res) => res.mission);
  },
  async updateMission(missionId: string, payload: Partial<Mission>) {
    return request<{ mission: Mission }>(`/missions/admin/${missionId}`, { method: 'PATCH', body: JSON.stringify(payload) }).then((res) => res.mission);
  },
  async deleteMission(missionId: string) {
    return request<{ ok: boolean }>(`/missions/admin/${missionId}`, { method: 'DELETE' });
  },
  async caddyClubs() {
    return request<{ clubs: ClubDistance[] }>('/caddy/clubs').then((res) => res.clubs);
  }
};
