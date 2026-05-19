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
  onOpenEdit: () => void;
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
  onOpenEdit
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
