const KEY = 'golftrainer.auth.tokens';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export const tokenStorage = {
  save(tokens: AuthTokens) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(KEY, JSON.stringify(tokens));
  },
  load(): AuthTokens | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthTokens;
    } catch {
      return null;
    }
  },
  clear() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(KEY);
  }
};
