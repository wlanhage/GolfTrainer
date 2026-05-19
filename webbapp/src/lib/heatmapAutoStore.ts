'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';

const STORAGE_PREFIX = 'golftrainer.webbapp.heatmapAuto.v1:';

const keyFor = (userId: string) => `${STORAGE_PREFIX}${userId}`;

const read = (userId: string): boolean => {
  if (typeof window === 'undefined' || !userId) return false;
  return window.localStorage.getItem(keyFor(userId)) === '1';
};

const write = (userId: string, value: boolean) => {
  if (typeof window === 'undefined' || !userId) return;
  window.localStorage.setItem(keyFor(userId), value ? '1' : '0');
};

export function useHeatmapAuto(): { enabled: boolean; setEnabled: (v: boolean) => void } {
  const { me } = useAuth();
  const userId = me?.id ?? '';
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    setEnabledState(read(userId));
  }, [userId]);

  const setEnabled = useCallback(
    (value: boolean) => {
      setEnabledState(value);
      write(userId, value);
    },
    [userId]
  );

  return { enabled, setEnabled };
}
