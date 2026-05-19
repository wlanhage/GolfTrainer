'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useCaddyApi } from '@/lib/api';
import { useToast } from '@/lib/ToastProvider';
import { caddyClubs } from '@/lib/caddyClubs';
import { CaddyLandingHeatmap } from '@/components/CaddyLandingHeatmap';
import { emptyShotInput, type CaddyClubSummary, type CaddyShot, type CaddyShotInput } from '@/lib/types';

const fmt = (v: number | undefined, unit: string) => (v === undefined ? 'Saknas' : `${v.toFixed(1)} ${unit}`);

function Field({
  label,
  value,
  onChange,
  placeholder,
  required
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-700">
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}

function SummaryRow({ label, value, required }: { label: string; value: string; required?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-700">
        {label}
        {required ? ' *' : ''}
      </span>
      <span className="text-sm font-bold text-ink">{value}</span>
    </div>
  );
}

export default function ClubDetailPage() {
  const params = useParams();
  const clubId = String(params?.clubId ?? '');
  const api = useCaddyApi();
  const toast = useToast();

  const club = useMemo(() => caddyClubs.find((c) => c.id === clubId), [clubId]);
  const [form, setForm] = useState<CaddyShotInput>(emptyShotInput);
  const [shots, setShots] = useState<CaddyShot[]>([]);
  const [summary, setSummary] = useState<CaddyClubSummary | null>(null);

  const refresh = useCallback(async () => {
    const [nextShots, summaries] = await Promise.all([api.listShotsForClub(clubId), api.listClubSummaries()]);
    setShots(nextShots);
    setSummary(summaries.find((s) => s.clubKey === clubId) ?? null);
  }, [api, clubId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onAddShot = async () => {
    const distance = Number(form.distanceMeters);
    const lateral = Number(form.lateralOffsetMeters);
    const height = form.peakHeightMeters.trim() ? Number(form.peakHeightMeters) : undefined;
    const spin = form.spinRpm.trim() ? Number(form.spinRpm) : undefined;
    if (!form.distanceMeters.trim() || Number.isNaN(distance) || distance <= 0) {
      toast.error('Längd (meter) är obligatorisk och måste vara större än 0.');
      return;
    }
    if (!form.lateralOffsetMeters.trim() || Number.isNaN(lateral)) {
      toast.error('Höger-vänster (meter) är obligatorisk för varje slag.');
      return;
    }
    if (form.peakHeightMeters.trim() && Number.isNaN(height)) {
      toast.error('Höjd måste vara ett nummer.');
      return;
    }
    if (form.spinRpm.trim() && Number.isNaN(spin)) {
      toast.error('Spinn måste vara ett nummer.');
      return;
    }

    await api.addShot(clubId, { distanceMeters: distance, lateralOffsetMeters: lateral, peakHeightMeters: height, spinRpm: spin });
    setForm(emptyShotInput());
    await refresh();
  };

  const onDelete = async (id: string) => {
    await api.removeShot(id);
    await refresh();
  };

  const heatmapPoints = useMemo(() => {
    const center = summary?.distanceMeters ?? (shots.length > 0 ? shots.reduce((s, x) => s + x.distanceMeters, 0) / shots.length : 0);
    return shots.map((s) => ({ x: s.lateralOffsetMeters, y: s.distanceMeters - center }));
  }, [shots, summary?.distanceMeters]);

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{club?.name ?? 'Klubba'}</h1>
        <button
          className="btn-secondary py-1.5 px-2.5 text-xs rounded-lg"
          onClick={() => toast.info('Importera slag är inte implementerat ännu.')}
        >
          Importera slag
        </button>
      </div>
      <p className="text-slate-600">Data sparas i backend och summeras automatiskt från inmatade slag.</p>

      <section className="bg-white border border-border rounded-2xl p-4 flex flex-col gap-3">
        <h2 className="font-bold">Lägg till slag</h2>
        <Field label="Längd (meter)" required value={form.distanceMeters} onChange={(v) => setForm((p) => ({ ...p, distanceMeters: v }))} placeholder="t.ex. 154" />
        <Field
          label="Höger-vänster (meter)"
          required
          value={form.lateralOffsetMeters}
          onChange={(v) => setForm((p) => ({ ...p, lateralOffsetMeters: v }))}
          placeholder="negativt = vänster, positivt = höger"
        />
        <Field label="Höjd (meter)" value={form.peakHeightMeters} onChange={(v) => setForm((p) => ({ ...p, peakHeightMeters: v }))} placeholder="valfritt" />
        <Field label="Spinn (rpm)" value={form.spinRpm} onChange={(v) => setForm((p) => ({ ...p, spinRpm: v }))} placeholder="valfritt" />
        <button onClick={() => void onAddShot()} className="btn-primary mt-2">
          Lägg till slag
        </button>
      </section>

      <section className="bg-white border border-border rounded-2xl p-4 flex flex-col gap-2">
        <h2 className="font-bold">Sammanfattning ({summary?.sampleCount ?? 0} slag)</h2>
        <p className="text-xs text-slate-500">
          Trimning: {summary?.trimPercentEachSide ?? 0}% per sida ({summary?.trimmedSampleCount ?? 0} slag kvar)
        </p>
        <SummaryRow label="Längd" value={fmt(summary?.distanceMeters, 'm')} required />
        <SummaryRow label="Spridning höger-vänster" value={fmt(summary?.dispersionMeters, 'm')} required />
        <SummaryRow label="Höjd" value={fmt(summary?.peakHeightMeters, 'm')} />
        <SummaryRow label="Spinn" value={fmt(summary?.spinRpm, 'rpm')} />
      </section>

      <section className="bg-white border border-border rounded-2xl p-4 flex flex-col gap-2">
        <h2 className="font-bold">Landnings-heatmap</h2>
        <CaddyLandingHeatmap points={heatmapPoints} onCellPress={(cell) => toast.info(`${cell.count} slag i rutan (${cell.percentage}%).`)} />
      </section>

      <section className="bg-white border border-border rounded-2xl p-4 flex flex-col gap-2">
        <h2 className="font-bold">Inmatade slag</h2>
        {shots.length === 0 ? (
          <p className="text-sm text-slate-500">Inga slag registrerade ännu.</p>
        ) : (
          shots.map((shot, index) => (
            <div key={shot.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
              <span className="text-sm text-ink">
                #{shots.length - index} · {shot.distanceMeters} m · {shot.lateralOffsetMeters} m sidled
              </span>
              <button onClick={() => void onDelete(shot.id)} className="text-danger font-semibold text-sm">
                Ta bort
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
