'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useNotificationsApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import type { AppNotification } from '@/lib/types';
import { formatRelative } from '@/lib/format';

export function NotificationBell() {
  const { status } = useAuth();
  const api = useNotificationsApi();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const c = await api.unreadCount();
      setUnread(c.count);
    } catch {
      // ignore
    }
  }, [api, status]);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  // Escape stänger + body-scroll lås medan modal är öppen
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const openList = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const list = await api.list({ limit: 20 });
      setItems(list);
    } finally {
      setLoading(false);
    }
  };

  const onTapItem = async (n: AppNotification) => {
    setOpen(false);
    if (!n.readAt) {
      try {
        await api.markRead(n.id);
      } catch {
        // ignore — vi navigerar ändå
      }
    }
    if (n.url) router.push(n.url);
    void refresh();
  };

  const onMarkAll = async () => {
    try {
      await api.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnread(0);
    } catch {
      // ignore
    }
  };

  if (status !== 'authenticated') return null;

  // Modalen portal:as till body för att slippa CSS-transform-baggar
  // (scale-wrapper på hemskärmen) som annars fångar position:fixed.
  const sheet =
    open && typeof window !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <button
              type="button"
              aria-label="Stäng"
              className="flex-1 bg-slate-900/40 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              className="bg-white rounded-t-2xl flex flex-col gap-3 w-full"
              style={{
                maxHeight: '85dvh',
                paddingTop: '0.75rem',
                paddingLeft: '1rem',
                paddingRight: '1rem',
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-slate-300 rounded-full self-center" />
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-extrabold text-ink">Notiser</h3>
                <div className="flex items-center gap-3">
                  {items.some((n) => !n.readAt) ? (
                    <button onClick={() => void onMarkAll()} className="text-primary text-sm font-bold">
                      Markera alla lästa
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Stäng"
                    onClick={() => setOpen(false)}
                    className="text-slate-500 text-2xl leading-none px-1 w-9 h-9 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              </div>

              {loading ? (
                <p className="text-slate-500 text-sm py-4 text-center">Laddar…</p>
              ) : items.length === 0 ? (
                <p className="text-slate-500 text-sm py-4 text-center">Inga notiser än.</p>
              ) : (
                <div className="flex flex-col gap-1.5 overflow-y-auto -mx-1 px-1">
                  {items.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => void onTapItem(n)}
                      className={`text-left rounded-xl border-2 px-3 py-2.5 ${
                        n.readAt ? 'border-border bg-white' : 'border-primary bg-primary-softer'
                      }`}
                    >
                      <p className="font-bold text-ink text-sm">{n.title}</p>
                      <p className="text-slate-700 text-xs mt-0.5">{n.body}</p>
                      <p className="text-slate-500 text-[11px] mt-1">{formatRelative(n.createdAt)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        aria-label="Notiser"
        onClick={() => void openList()}
        className="relative flex items-center justify-center w-11 h-11 text-primary"
      >
        <Bell size={22} />
        {unread > 0 ? (
          <span className="absolute top-2 right-2 bg-danger rounded-full w-2.5 h-2.5" />
        ) : null}
      </button>
      {sheet}
    </>
  );
}
