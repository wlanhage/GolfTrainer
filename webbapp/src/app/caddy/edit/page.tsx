'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useCaddyApi } from '@/lib/api';
import { caddyClubs } from '@/lib/caddyClubs';
import type { CaddyClubSummary } from '@/lib/types';

export default function CaddyEditPage() {
  const api = useCaddyApi();
  const [summaries, setSummaries] = useState<CaddyClubSummary[]>([]);

  useEffect(() => {
    api.listClubSummaries().then(setSummaries).catch(() => undefined);
  }, [api]);

  const byKey = useMemo(() => new Map(summaries.map((s) => [s.clubKey, s])), [summaries]);

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-3xl font-bold">Edit caddy</h1>
      <p className="text-slate-600 mb-2">Välj klubba för att lägga till eller ta bort slag.</p>
      <div className="grid grid-cols-3 gap-2">
        {caddyClubs.map((club) => {
          const s = byKey.get(club.id);
          return (
            <Link
              key={club.id}
              href={`/caddy/${club.id}`}
              className="bg-white border border-border rounded-xl min-h-20 flex flex-col items-center justify-center gap-1 px-2 py-3"
            >
              <span className="text-sm font-semibold text-ink text-center">{club.name}</span>
              <span className="text-xs text-slate-500">{s?.sampleCount ?? 0} slag</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
