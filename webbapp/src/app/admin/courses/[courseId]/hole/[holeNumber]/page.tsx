'use client';

import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useCoursesApi } from '@/lib/api';
import { useToast } from '@/lib/ToastProvider';
import { createEmptyLayoutGeometry } from '@/lib/holeGeometry';
import { parseOptionalHcpIndex, parseOptionalPositiveNumber } from '@/lib/validation';
import type { HoleLayoutGeometry } from '@/lib/types';
import { Loader } from '@/components/Loader';

const HoleLayoutEditor = dynamic(() => import('@/components/HoleLayoutEditor').then((m) => m.HoleLayoutEditor), { ssr: false });

export default function HoleEditPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = String(params?.courseId ?? '');
  const holeNumber = Number(params?.holeNumber ?? 1);
  const api = useCoursesApi();
  const toast = useToast();

  const [maxHole, setMaxHole] = useState(18);
  const [meta, setMeta] = useState({ par: '', length: '', hcpIndex: '' });
  const [layout, setLayout] = useState<HoleLayoutGeometry | null>(null);

  const load = useCallback(async () => {
    const detail = await api.getCourseDetail(courseId);
    if (!detail) return;
    setMaxHole(detail.holes.length);
    const target = detail.holes.find((h) => h.holeNumber === holeNumber);
    if (!target) return;
    setMeta({
      par: target.par?.toString() ?? '',
      length: target.length?.toString() ?? '',
      hcpIndex: target.hcpIndex?.toString() ?? ''
    });
    setLayout(target.layout?.geometry ?? createEmptyLayoutGeometry());
  }, [api, courseId, holeNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!layout) return <Loader label="Laddar hål" />;

  const save = async () => {
    try {
      await api.updateHoleMeta(courseId, holeNumber, {
        par: parseOptionalPositiveNumber(meta.par),
        length: parseOptionalPositiveNumber(meta.length),
        hcpIndex: parseOptionalHcpIndex(meta.hcpIndex)
      });
      await api.updateHoleLayout(courseId, holeNumber, layout);
      toast.success(`Hål ${holeNumber} uppdaterat.`);
    } catch (e) {
      toast.error(`Kunde inte spara hål: ${(e as Error).message}`);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <div>
        <h1 className="text-3xl font-extrabold text-ink">Hål {holeNumber}</h1>
        <p className="text-sm text-slate-600">
          Par: {meta.par || '-'} • Längd: {meta.length || '-'} • HCP: {meta.hcpIndex || '-'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-semibold text-slate-700 text-sm">Hålmetadata (valfritt under rundan)</p>
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            placeholder="Par"
            value={meta.par}
            onChange={(e) => setMeta((m) => ({ ...m, par: e.target.value }))}
            className="input flex-1"
          />
          <input
            inputMode="numeric"
            placeholder="Längd"
            value={meta.length}
            onChange={(e) => setMeta((m) => ({ ...m, length: e.target.value }))}
            className="input flex-1"
          />
          <input
            inputMode="numeric"
            placeholder="HCP"
            value={meta.hcpIndex}
            onChange={(e) => setMeta((m) => ({ ...m, hcpIndex: e.target.value }))}
            className="input flex-1"
          />
        </div>
        <button onClick={() => void save()} className="btn-secondary self-start py-2 px-3 text-sm">
          Spara metadata
        </button>
      </div>

      <HoleLayoutEditor geometry={layout} onChange={setLayout} onSave={() => void save()} />

      <div className="flex gap-2">
        <button onClick={() => router.push(`/admin/courses/${courseId}`)} className="flex-1 btn-secondary py-3">
          Tillbaka till bana
        </button>
      </div>

      <div className="flex gap-2">
        {holeNumber > 1 ? (
          <button
            onClick={() => router.replace(`/admin/courses/${courseId}/hole/${holeNumber - 1}`)}
            className="flex-1 btn-secondary py-3"
          >
            Föregående
          </button>
        ) : null}
        {holeNumber < maxHole ? (
          <button
            onClick={() => router.replace(`/admin/courses/${courseId}/hole/${holeNumber + 1}`)}
            className="flex-1 btn-secondary py-3"
          >
            Nästa
          </button>
        ) : null}
      </div>

      <button onClick={() => void save()} className="btn-primary">
        Spara hål
      </button>
    </div>
  );
}
