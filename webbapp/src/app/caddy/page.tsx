'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useCaddyApi } from '@/lib/api';
import { caddyClubs } from '@/lib/caddyClubs';
import type { CaddyClubSummary } from '@/lib/types';

const formatMeters = (v: number | undefined) => (v === undefined ? '-' : `${Math.round(v)} m`);
const formatSide = (v: number | undefined) => {
  if (v === undefined) return '-';
  const r = Math.round(Math.abs(v));
  if (r === 0) return '0';
  return `${r}${v < 0 ? 'v' : 'h'}`;
};

export default function CaddyGridPage() {
  const api = useCaddyApi();
  const [summaries, setSummaries] = useState<CaddyClubSummary[]>([]);

  useEffect(() => {
    api.listClubSummaries().then(setSummaries).catch(() => undefined);
  }, [api]);

  const byKey = useMemo(() => new Map(summaries.map((s) => [s.clubKey, s])), [summaries]);
  const withData = useMemo(
    () => caddyClubs.map((c) => ({ c, s: byKey.get(c.id) })).filter((it): it is { c: typeof caddyClubs[number]; s: CaddyClubSummary } => Boolean(it.s?.sampleCount)),
    [byKey]
  );

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Caddy</h1>
        <Link href="/caddy/edit" className="btn-secondary py-2 px-3 text-sm">
          Edit
        </Link>
      </div>
      <p className="text-slate-600">Klubbor med inlagda slag, sorterade från driver och neråt.</p>

      <div className="border border-border rounded-xl bg-white overflow-hidden">
        <div className="flex bg-primary-soft px-3 py-2 text-xs font-extrabold text-primary">
          <div className="flex-[1.25]">Namn</div>
          <div className="flex-1 text-right">Längd</div>
          <div className="flex-1 text-right">Spridning</div>
          <div className="flex-1 text-right">Höjd</div>
        </div>
        {withData.length === 0 ? (
          <div className="p-4 flex flex-col items-center gap-3">
            <p className="text-slate-500 text-center">Inga klubbor med inlagda slag ännu.</p>
            <Link href="/caddy/edit" className="btn-primary py-2 px-3 text-sm">
              Lägg till slag
            </Link>
          </div>
        ) : (
          withData.map(({ c, s }) => (
            <Link
              key={c.id}
              href={`/caddy/${c.id}`}
              className="flex items-center px-3 py-3 border-t border-border min-h-12 active:bg-primary-softer"
            >
              <div className="flex-[1.25] font-bold text-ink truncate">{c.name}</div>
              <div className="flex-1 text-right font-bold text-sm">{formatMeters(s.distanceMeters)}</div>
              <div className="flex-1 text-right font-bold text-sm">{formatSide(s.lateralOffsetMeters)}</div>
              <div className="flex-1 text-right font-bold text-sm">{formatMeters(s.peakHeightMeters)}</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
