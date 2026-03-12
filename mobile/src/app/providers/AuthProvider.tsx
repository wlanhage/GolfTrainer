import { ReactNode, useEffect, useMemo, useState } from 'react';
import { authApi } from '../../features/auth/api/authApi';
import { MeResponse } from '../../features/profile/types/profile';
import { ApiClient } from '../../shared/api/apiClient';
import { tokenStorage } from '../../shared/api/tokenStorage';
import { AuthContext, AuthTokens } from '../../shared/store/authStore';

type Props = { children: ReactNode };

const loadMe = async (tokens: AuthTokens | null) => {
  if (!tokens) return null;

  const client = new ApiClient({
    getAccessToken: async () => tokens.accessToken,
    onUnauthorized: async () => null
  });

  return client.request<MeResponse>('/users/me');
};

export function AuthProvider({ children }: Props) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'guest'>('loading');

  useEffect(() => {
    (async () => {
      const stored = await tokenStorage.load();
      if (stored) {
        try {
          const loadedMe = await loadMe(stored);
          setMe(loadedMe);
          setTokens(stored);
          setStatus('authenticated');
        } catch {
          await tokenStorage.clear();
          setStatus('guest');
          setTokens(null);
          setMe(null);
        }
      } else {
        setStatus('guest');
      }
    })();
  }, []);

  const value = useMemo(
    () => ({
      status,
      tokens,
      me,
      reloadMe: async () => {
        const loadedMe = await loadMe(tokens);
        setMe(loadedMe);
      },
      register: async (input: { email: string; password: string; displayName: string }) => {
        const next = await authApi.register(input);
        const loadedMe = await loadMe(next);
        setMe(loadedMe);
        setTokens(next);
        setStatus('authenticated');
        await tokenStorage.save(next);
      },
      login: async (email: string, password: string) => {
        const next = await authApi.login({ email, password });
        const loadedMe = await loadMe(next);
        setMe(loadedMe);
        setTokens(next);
        setStatus('authenticated');
        await tokenStorage.save(next);
      },
      logout: async () => {
        const refreshToken = tokens?.refreshToken;
        if (refreshToken) {
          await authApi.logout(refreshToken);
        }
        setTokens(null);
        setMe(null);
        setStatus('guest');
        await tokenStorage.clear();
      },
      getValidAccessToken: async () => {
        if (!tokens) return null;
        return tokens.accessToken;
      },
      refreshSession: async () => {
        if (!tokens?.refreshToken) {
          return null;
        }

        try {
          const next = await authApi.refresh(tokens.refreshToken);
          setTokens(next);
          await tokenStorage.save(next);
          const loadedMe = await loadMe(next);
          setMe(loadedMe);
          setStatus('authenticated');
          return next.accessToken;
        } catch {
          setTokens(null);
          setMe(null);
          setStatus('guest');
          await tokenStorage.clear();
          return null;
        }
      }
    }),
    [status, tokens, me]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
