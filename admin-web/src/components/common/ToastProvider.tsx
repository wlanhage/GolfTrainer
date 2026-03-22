'use client';

import { createContext, useContext, useMemo, useState } from 'react';

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };
const ToastContext = createContext<{ push: (message: string, type?: Toast['type']) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const value = useMemo(() => ({
    push: (message: string, type: Toast['type'] = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
      window.setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 2500);
    }
  }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => <div key={toast.id} className={`toast ${toast.type}`}>{toast.message}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast måste användas inom ToastProvider');
  return ctx;
}
