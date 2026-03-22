'use client';

import { useEffect } from 'react';

type Options = {
  hasUnsavedChanges: boolean;
  message?: string;
};

export function useUnsavedChanges({ hasUnsavedChanges, message = 'Du har osparade ändringar. Vill du lämna sidan?' }: Options) {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, message]);

  const confirmLeave = () => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(message);
  };

  return { confirmLeave };
}
