'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCoursesApi } from '@/lib/api';
import { useRoundsStore } from '@/lib/roundsStore';
import { useToast } from '@/lib/ToastProvider';
import type { ScorecardSetupMode } from '@/lib/types';
import { parseOptionalHcpIndex, parseOptionalPositiveNumber } from '@/lib/validation';

type Row = { holeNumber: number; par: string; length: string; hcpIndex: string; holeId: string };

export default function ScorecardSetupPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = String(params?.courseId ?? '');
  const api = useCoursesApi();
  const roundsStore = useRoundsStore();
  const toast = useToast();

  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<ScorecardSetupMode>('skip');
  useEffect(() => {
    if (!courseId) return;
    api.getCourseDetail(courseId).then((d) => {
      if (!d) return;
      setRows(d.holes.map((h) => ({ holeNumber: h.holeNumber, par: '', length: '', hcpIndex: '', holeId: h.id })));
    });
  }, [api, courseId]);

  const startRound = async () => {
    const round = await roundsStore.startRound(courseId);
    router.replace(`/play/round/${round.id}/1`);
  };

  const saveBulkAndStart = async () => {
    try {
      for (const row of rows) {
        await api.updateHoleMeta(courseId, row.holeNumber, {
          par: parseOptionalPositiveNumber(row.par),
          length: parseOptionalPositiveNumber(row.length),
          hcpIndex: parseOptionalHcpIndex(row.hcpIndex)
        });
      }
      await startRound();
    } catch (e) {
      toast.error(`Kunde inte spara scorekort: ${(e as Error).message}`);
    }
  };

  const onSelectMode = async (next: ScorecardSetupMode) => {
    setMode(next);
    if (next === 'bulk_now') return;
    await startRound();
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-2xl font-extrabold text-ink">Hur vill du lägga till scorekortet?</h1>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onSelectMode('bulk_now')}
          className={`border-2 rounded-xl p-3 text-left font-semibold ${
            mode === 'bulk_now' ? 'border-primary bg-primary-softer' : 'border-border bg-white'
          }`}
        >
          1. Lägg till scorekort nu
        </button>
        <button
          onClick={() => onSelectMode('per_hole')}
          className="border-2 border-border rounded-xl bg-white p-3 text-left font-semibold"
        >
          2. Lägg till vid varje tee
        </button>
        <button
          onClick={() => onSelectMode('skip')}
          className="border-2 border-border rounded-xl bg-white p-3 text-left font-semibold"
        >
          3. Hoppa över tills vidare
        </button>
      </div>

      {mode === 'bulk_now' ? (
        <div className="bg-white border border-border rounded-xl p-3 flex flex-col gap-2">
          <h2 className="font-bold">Fyll scorekort för alla hål</h2>
          <div className="max-h-[420px] overflow-auto flex flex-col gap-1.5">
            {rows.map((row) => (
              <div key={row.holeNumber} className="flex items-center gap-1.5">
                <span className="w-14 text-sm">Hål {row.holeNumber}</span>
                <input
                  inputMode="numeric"
                  placeholder="Par"
                  value={row.par}
                  onChange={(e) => setRows((cur) => cur.map((r) => (r.holeNumber === row.holeNumber ? { ...r, par: e.target.value } : r)))}
                  className="flex-1 border border-border rounded-md px-2 py-2 bg-white focus:outline-none focus:border-primary"
                />
                <input
                  inputMode="numeric"
                  placeholder="Längd"
                  value={row.length}
                  onChange={(e) => setRows((cur) => cur.map((r) => (r.holeNumber === row.holeNumber ? { ...r, length: e.target.value } : r)))}
                  className="flex-1 border border-border rounded-md px-2 py-2 bg-white focus:outline-none focus:border-primary"
                />
                <input
                  inputMode="numeric"
                  placeholder="HCP"
                  value={row.hcpIndex}
                  onChange={(e) => setRows((cur) => cur.map((r) => (r.holeNumber === row.holeNumber ? { ...r, hcpIndex: e.target.value } : r)))}
                  className="flex-1 border border-border rounded-md px-2 py-2 bg-white focus:outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
          <button onClick={() => void saveBulkAndStart()} className="btn-primary">
            Spara scorekort
          </button>
        </div>
      ) : null}
    </div>
  );
}
