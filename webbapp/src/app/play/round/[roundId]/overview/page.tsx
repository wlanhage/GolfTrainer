'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCoursesApi } from '@/lib/api';
import { useRoundsStore } from '@/lib/roundsStore';
import type { HoleLayoutGeometry, RoundOverview } from '@/lib/types';

export default function RoundOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const roundId = String(params?.roundId ?? '');
  const api = useCoursesApi();
  const roundsStore = useRoundsStore();
  const [overview, setOverview] = useState<RoundOverview | null>(null);

  useEffect(() => {
    if (!roundsStore.ready) return;
    let active = true;
    void (async () => {
      const round = await roundsStore.getRound(roundId);
      if (!active) return;
      if (!round) {
        router.replace('/play');
        return;
      }
      const detail = await api.getCourseDetail(round.round.courseId);
      const layoutByHoleId = new Map<string, HoleLayoutGeometry>();
      detail?.holes.forEach((h) => {
        if (h.layout) layoutByHoleId.set(h.id, h.layout.geometry);
      });
      const ov = await roundsStore.getOverview(roundId, layoutByHoleId);
      if (active) setOverview(ov);
    })();
    return () => {
      active = false;
    };
  }, [api, roundId, router, roundsStore]);

  if (!overview) return <div className="p-6">Laddar översikt...</div>;

  const rel =
    overview.relativeToPar === null ? '-' : overview.relativeToPar >= 0 ? `+${overview.relativeToPar}` : `${overview.relativeToPar}`;

  return (
    <div className="p-4 flex flex-col gap-2">
      <h1 className="text-3xl font-extrabold text-ink">Rundöversikt</h1>
      <p className="text-slate-700">
        Score: {overview.totalScore} • Par: {overview.totalPar} • Relativt par: {rel}
      </p>
      <p className="text-slate-700">
        Registrerade hål: {overview.completedHoles}/{overview.items.length}
      </p>

      <div className="flex flex-col gap-2 mt-2">
        {overview.items.map((item) => (
          <button
            key={item.holeNumber}
            onClick={() => {
              void roundsStore.setCurrentHole(roundId, item.holeNumber);
              router.push(`/play/round/${roundId}/${item.holeNumber}`);
            }}
            className="bg-white border border-border rounded-lg px-3 py-3 flex items-center justify-between text-left"
          >
            <div>
              <div className="font-bold text-ink">Hål {item.holeNumber}</div>
              <div className="text-xs text-slate-500">
                Par {item.par ?? '-'} • Längd {item.length ?? '-'} • HCP {item.hcpIndex ?? '-'}
              </div>
            </div>
            <div className="text-2xl font-bold text-primary">{item.strokes ?? '-'}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
