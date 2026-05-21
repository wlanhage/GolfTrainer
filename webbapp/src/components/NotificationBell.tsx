'use client';

import { useCallback, useEffect, useState } from 'react';
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

  // Pollar inte — bara mount + tab-visibility för att slippa onödig trafik.
  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

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
          <span className="absolute top-1.5 right-1.5 bg-danger text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col">
          <button
            aria-label="Stäng"
            className="flex-1 bg-slate-900/40"
            onClick={() => setOpen(false)}
          />
          <div className="bg-white rounded-t-2xl p-4 flex flex-col gap-3 max-h-[70vh]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">Notiser</h3>
              {items.some((n) => !n.readAt) ? (
                <button onClick={() => void onMarkAll()} className="text-primary text-sm font-bold">
                  Markera alla lästa
                </button>
              ) : null}
            </div>
            {loading ? (
              <p className="text-slate-500 text-sm">Laddar…</p>
            ) : items.length === 0 ? (
              <p className="text-slate-500 text-sm">Inga notiser än.</p>
            ) : (
              <div className="flex flex-col gap-1.5 overflow-y-auto">
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
        </div>
      ) : null}
    </>
  );
}
