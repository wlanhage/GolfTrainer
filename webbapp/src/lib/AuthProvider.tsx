'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiClient } from './apiClient';
import { authApi } from './authApi';
import { tokenStorage, type AuthTokens } from './tokenStorage';
import type { MeResponse } from './types';

type Status = 'loading' | 'authenticated' | 'guest';

type AuthValue = {
  status: Status;
  tokens: AuthTokens | null;
  me: MeResponse | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  getValidAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<string | null>;
  reloadMe: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export const useAuth = () => {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
};

const loadMe = async (tokens: AuthTokens | null) => {
  if (!tokens) return null;
  const client = new ApiClient({
    getAccessToken: async () => tokens.accessToken,
    onUnauthorized: async () => null
  });
  return client.request<MeResponse>('/users/me');
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    (async () => {
      const stored = tokenStorage.load();
      if (!stored) {
        setStatus('guest');
        return;
      }
      try {
        const loaded = await loadMe(stored);
        setMe(loaded);
        setTokens(stored);
        setStatus('authenticated');
      } catch {
        tokenStorage.clear();
        setStatus('guest');
        setTokens(null);
        setMe(null);
      }
    })();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      tokens,
      me,
      reloadMe: async () => {
        const loaded = await loadMe(tokens);
        setMe(loaded);
      },
      register: async (input) => {
        const next = await authApi.register(input);
        const loaded = await loadMe(next);
        setMe(loaded);
        setTokens(next);
        setStatus('authenticated');
        tokenStorage.save(next);
      },
      login: async (email, password) => {
        const next = await authApi.login({ email, password });
        const loaded = await loadMe(next);
        setMe(loaded);
        setTokens(next);
        setStatus('authenticated');
        tokenStorage.save(next);
      },
      logout: async () => {
        const refreshToken = tokens?.refreshToken;
        if (refreshToken) await authApi.logout(refreshToken).catch(() => undefined);
        setTokens(null);
        setMe(null);
        setStatus('guest');
        tokenStorage.clear();
      },
      getValidAccessToken: async () => tokens?.accessToken ?? null,
      refreshSession: async () => {
        if (!tokens?.refreshToken) return null;
        try {
          const next = await authApi.refresh(tokens.refreshToken);
          setTokens(next);
          tokenStorage.save(next);
          const loaded = await loadMe(next);
          setMe(loaded);
          setStatus('authenticated');
          return next.accessToken;
        } catch {
          setTokens(null);
          setMe(null);
          setStatus('guest');
          tokenStorage.clear();
          return null;
        }
      }
    }),
    [status, tokens, me]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useApiClient() {
  const { getValidAccessToken, refreshSession } = useAuth();
  return useMemo(
    () =>
      new ApiClient({
        getAccessToken: getValidAccessToken,
        onUnauthorized: refreshSession
      }),
    [getValidAccessToken, refreshSession]
  );
}
