'use client';

import { useEffect, useRef, useState } from 'react';

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error';

type Options<T> = {
  value: T;
  onSave: (value: T) => Promise<void>;
  delay?: number;
  enabled?: boolean;
};

export function useAutosave<T>({ value, onSave, delay = 800, enabled = true }: Options<T>) {
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const previousValueRef = useRef(JSON.stringify(value));

  useEffect(() => {
    if (!enabled) return;
    const next = JSON.stringify(value);
    if (next === previousValueRef.current) return;

    setSaveState('unsaved');

    const timer = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        await onSave(value);
        previousValueRef.current = JSON.stringify(value);
        setLastSavedAt(new Date());
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [delay, enabled, onSave, value]);

  return { saveState, lastSavedAt, setSaveState };
}
