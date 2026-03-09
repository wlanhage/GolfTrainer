import { useCallback, useEffect, useState } from 'react';
import { useProfileApi } from '../api/profileApi';
import type { MeResponse } from '../types/profile';

export function useProfile() {
  const { getMe } = useProfileApi();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await getMe());
    } catch {
      setError('Kunde inte hämta profil.');
    } finally {
      setLoading(false);
    }
  }, [getMe]);

  useEffect(() => {
    void load();
  }, [load]);

  return { profile, loading, error, reload: load };
}
