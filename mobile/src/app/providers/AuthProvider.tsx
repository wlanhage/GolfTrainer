import { ReactNode, useEffect, useMemo, useState } from 'react';
import { authApi } from '../../features/auth/api/authApi';
import { tokenStorage } from '../../shared/api/tokenStorage';
import { AuthContext, AuthTokens } from '../../shared/store/authStore';

type Props = { children: ReactNode };

export function AuthProvider({ children }: Props) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'guest'>('loading');

  useEffect(() => {
    (async () => {
      const stored = await tokenStorage.load();
      if (stored) {
        setTokens(stored);
        setStatus('authenticated');
      } else {
        setStatus('guest');
      }
    })();
  }, []);

  const value = useMemo(
    () => ({
      status,
      tokens,
      login: async (email: string, password: string) => {
        const next = await authApi.login({ email, password });
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
          setStatus('authenticated');
          await tokenStorage.save(next);
          return next.accessToken;
        } catch {
          setTokens(null);
          setStatus('guest');
          await tokenStorage.clear();
          return null;
        }
      },
    }),
    [status, tokens]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
