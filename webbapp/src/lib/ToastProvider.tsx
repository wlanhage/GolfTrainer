'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type ToastKind = 'info' | 'success' | 'error';

type Toast = {
  id: string;
  message: string;
  kind: ToastKind;
};

type ToastValue = {
  show: (message: string, kind?: ToastKind, durationMs?: number) => void;
  info: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastValue | null>(null);

export function useToast(): ToastValue {
  const v = useContext(ToastContext);
  if (!v) throw new Error('useToast must be used inside ToastProvider');
  return v;
}

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = 'info', durationMs = 3200) => {
    const id = newId();
    setToasts((prev) => [...prev, { id, message, kind }]);
    if (durationMs > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    }
  }, []);

  const value: ToastValue = {
    show,
    info: (m) => show(m, 'info'),
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error')
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(true), 10);
    return () => window.clearTimeout(id);
  }, []);

  const palette =
    toast.kind === 'success'
      ? 'bg-primary text-white'
      : toast.kind === 'error'
        ? 'bg-danger text-white'
        : 'bg-slate-900 text-white';

  return (
    <div
      role="status"
      onClick={onDismiss}
      className={`pointer-events-auto max-w-md w-full rounded-xl px-4 py-3 shadow-lg font-semibold text-sm transition-all duration-200 ${palette} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {toast.message}
    </div>
  );
}
