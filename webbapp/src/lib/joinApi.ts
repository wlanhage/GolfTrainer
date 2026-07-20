import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import type { AuthResponse } from './authApi';

export type InviteInfo = {
  hostName: string;
  roundStatus: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | null;
  round: {
    roundId: string;
    currentHoleNumber: number;
    courseName: string;
    clubName: string;
  } | null;
};

export type GuestJoinResult = {
  tokens: AuthResponse;
  roundId: string;
  currentHoleNumber: number;
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

/** Publika join-anrop — används på join-sidan innan man är inloggad. */
export const joinApi = {
  async getInviteInfo(code: string): Promise<InviteInfo> {
    const res = await timedFetch(`${API_BASE_URL}/join/invites/${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error(res.status === 404 ? 'Inbjudan hittades inte' : 'Kunde inte hämta inbjudan');
    return res.json();
  },
  async joinAsGuest(code: string, name: string): Promise<GuestJoinResult> {
    const res = await timedFetch(`${API_BASE_URL}/join/invites/${encodeURIComponent(code)}/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Kunde inte joina rundan');
    return res.json();
  }
};
