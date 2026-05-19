'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTrainingApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { SkeletonRow } from '@/components/Skeleton';
import type { TrainingMission } from '@/lib/types';

export default function TrainingListPage() {
  const api = useTrainingApi();
  const [missions, setMissions] = useState<TrainingMission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listMissions()
      .then((list) => {
        setMissions(list);
        setError(null);
      })
      .catch(() => setError('Kunde inte hämta träningsmissioner'))
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <div className="p-4 flex flex-col gap-2">
      <h1 className="text-3xl font-bold text-ink">Träningsmissioner</h1>
      <p className="text-slate-600 mb-2">Välj en mission och registrera ditt resultat.</p>
      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <div className="flex flex-col gap-3">
        {missions.map((m) => (
          <Link
            key={m.id}
            href={`/training/${m.id}`}
            className="card flex items-center gap-3 active:bg-primary-softer"
          >
            <span className="text-3xl">{m.symbol}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-ink truncate">{m.title}</div>
              <div className="text-slate-600 text-sm line-clamp-2">{m.objective}</div>
              {m.endsAt ? (
                <div className="text-[11px] text-primary font-semibold mt-0.5">
                  Slutar {formatDate(m.endsAt)}
                </div>
              ) : null}
            </div>
            <span className="text-slate-400 text-lg">›</span>
          </Link>
        ))}
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : null}
        {!loading && missions.length === 0 && !error ? (
          <p className="text-slate-500">Inga aktiva missioner just nu.</p>
        ) : null}
      </div>
    </div>
  );
}
