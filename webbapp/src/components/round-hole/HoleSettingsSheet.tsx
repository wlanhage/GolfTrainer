'use client';

import { caddyClubs } from '@/lib/caddyClubs';
import type { ClubRecommendation } from '@/lib/clubRecommender';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  hasCaddyData: boolean;
  autoEnabled: boolean;
  onAutoChange: (enabled: boolean) => void;
  recommendation: ClubRecommendation | null;
  courseId: string | null;
  holeNumber: number;
  maxHole: number;
  onSelectHole: (holeNumber: number) => void;
  onOpenEdit: () => void;
  shotTrackingEnabled?: boolean;
  onOpenShotReview?: () => void;
};

export function HoleSettingsSheet({
  isOpen,
  onClose,
  hasCaddyData,
  autoEnabled,
  onAutoChange,
  recommendation,
  courseId,
  holeNumber,
  maxHole,
  onSelectHole,
  onOpenEdit,
  shotTrackingEnabled,
  onOpenShotReview
}: Props) {
  if (!isOpen) return null;

  const recommendedLabel = recommendation
    ? caddyClubs.find((c) => c.id === recommendation.clubKey)?.name ?? recommendation.clubKey
    : null;

  const recommendationDetail = recommendation
    ? recommendation.hitRatio !== undefined && recommendation.hitRatio > 0
      ? ` (${Math.round(recommendation.hitRatio * 100)}% green-hit)`
      : recommendation.reason === 'driver_fallback'
        ? ' (ingen klubba når green)'
        : recommendation.reason === 'longest_safe'
          ? ' (längsta säkra)'
          : ''
    : '';

  return (
    <div className="absolute inset-0 z-20 bg-slate-900/45 flex flex-col justify-end">
      <button className="flex-1" onClick={onClose} aria-label="Stäng" />
      <div className="bg-white rounded-t-2xl p-4 flex flex-col gap-3">
        <h3 className="text-lg font-extrabold">Inställningar</h3>
        <p className="text-xs text-slate-600">Kartvyn används alltid i fullskärm under spel.</p>

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Visa hål</span>
          <div className="relative">
            <select
              value={holeNumber}
              onChange={(e) => onSelectHole(Number(e.target.value))}
              className="appearance-none w-full text-3xl font-extrabold text-ink bg-white border-2 border-primary rounded-xl pl-5 pr-14 py-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {Array.from({ length: maxHole }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Hål {n}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-primary text-3xl leading-none"
              aria-hidden="true"
            >
              ▾
            </span>
          </div>
        </div>

        {hasCaddyData ? (
          <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={autoEnabled}
              onChange={(e) => onAutoChange(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-primary"
            />
            <span className="flex-1">
              <span className="block font-bold text-ink">Auto-välj klubba</span>
              <span className="block text-xs text-slate-600">
                Rutnätet markerar klubban som har bäst chans att landa på green från din position. Når ingen, väljs en
                säker lång klubba.
              </span>
              {autoEnabled && recommendation ? (
                <span className="block mt-1 text-xs text-amber-700 font-semibold">
                  Just nu: {recommendedLabel}
                  {recommendationDetail}
                </span>
              ) : null}
            </span>
          </label>
        ) : null}

        {shotTrackingEnabled && onOpenShotReview ? (
          <button
            onClick={() => { onClose(); onOpenShotReview(); }}
            className="btn-secondary"
          >
            Ändra slag (hål {holeNumber})
          </button>
        ) : null}

        {courseId ? (
          <button onClick={onOpenEdit} className="btn-secondary">
            Öppna edit view för hål {holeNumber}
          </button>
        ) : null}
        <button onClick={onClose} className="btn-primary">
          Stäng
        </button>
      </div>
    </div>
  );
}
