'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authApi } from '../lib/api';
import { tokenStorage } from '../lib/tokenStorage';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const tokens = tokenStorage.load();

      if (!tokens) {
        if (pathname !== '/login') router.replace('/login');
        else setReady(true);
        return;
      }

      if (pathname === '/login') {
        router.replace('/dashboard');
        return;
      }

      // We have stored tokens. The access token may already be expired — try
      // to refresh proactively so the admin doesn't hit an immediate 401 on
      // the first API call after a page reload.
      // If the refresh fails (revoked token, network down) the user goes to
      // /login. If it succeeds the session is extended silently.
      try {
        const next = await authApi.refresh(tokens.refreshToken);
        tokenStorage.save(next);
      } catch {
        // Refresh token is invalid — force re-login.
        tokenStorage.clear();
        router.replace('/login');
        return;
      }

      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return <div style={{ padding: 24 }}>Laddar admin...</div>;
  return <>{children}</>;
}
