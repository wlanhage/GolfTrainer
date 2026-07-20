'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useJoinApi } from '@/lib/api';

/**
 * Bottom sheet med QR-kod som låter andra joina rundan — med eller utan
 * konto. Koden skapas när sheeten öppnas och kopplas automatiskt till
 * rundan när hosten startar den.
 */
export function QrInviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const joinApi = useJoinApi();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setDataUrl(null);
    setError(null);
    joinApi
      .createInvite()
      .then(async ({ code }) => {
        const url = `${window.location.origin}/join/${code}`;
        const png = await QRCode.toDataURL(url, { width: 480, margin: 1 });
        if (active) {
          setJoinUrl(url);
          setDataUrl(png);
        }
      })
      .catch(() => {
        if (active) setError('Kunde inte skapa QR-koden. Försök igen.');
      });
    return () => {
      active = false;
    };
  }, [open, joinApi]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 flex flex-col justify-end">
      <button className="flex-1" aria-label="Stäng" onClick={onClose} />
      <div className="bg-white rounded-t-2xl p-4 flex flex-col items-center gap-3">
        <h3 className="text-lg font-extrabold text-ink">Bjud in med QR-kod</h3>
        <p className="text-sm text-slate-600 text-center">
          Låt en medspelare skanna koden för att joina rundan — även utan konto.
          De hoppar in så fort du startar spelet.
        </p>
        {error ? (
          <p className="text-danger text-sm">{error}</p>
        ) : dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR-kod för att joina rundan" className="w-60 h-60 rounded-xl border border-border" />
        ) : (
          <div className="w-60 h-60 rounded-xl border border-border bg-slate-50 animate-pulse" />
        )}
        {joinUrl ? (
          <p className="text-xs text-slate-400 break-all text-center">{joinUrl}</p>
        ) : null}
        <button onClick={onClose} className="btn-primary w-full">
          Klar
        </button>
      </div>
    </div>
  );
}
