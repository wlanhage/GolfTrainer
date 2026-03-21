'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = api.tokenStorage.get();
    if (!token && pathname !== '/login') {
      router.replace('/login');
      return;
    }
    if (token && pathname === '/login') {
      router.replace('/dashboard');
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) return <div style={{ padding: 24 }}>Laddar admin...</div>;
  return <>{children}</>;
}
