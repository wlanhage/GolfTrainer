'use client';

import type { GeoPoint } from '@/lib/types';
import { getGeoDistanceMeters } from '@/lib/holeGeometry';

const FAR_AWAY_THRESHOLD_M = 600;

type Props = {
  holeNumber: number;
  candidateCenter: GeoPoint;
  playerPosition: GeoPoint | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function CandidateConfirmSheet({ holeNumber, candidateCenter, playerPosition, onConfirm, onCancel }: Props) {
  const distance = playerPosition ? Math.round(getGeoDistanceMeters(playerPosition, candidateCenter)) : null;
  const farAway = distance != null && distance > FAR_AWAY_THRESHOLD_M;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8">
        <h3 className="text-base font-bold text-slate-800">Är detta green för hål {holeNumber}?</h3>
        <p className="mt-1 text-sm text-slate-500">
          {distance != null ? `Ca ${distance} m från dig · ` : ''}valet låses för banan
        </p>

        {farAway && (
          <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-sm text-amber-700 font-semibold">
            Du verkar inte vara vid banan
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 btn-secondary py-3">
            Avbryt
          </button>
          <button onClick={onConfirm} className="flex-[1.4] btn-primary py-3">
            Ja, detta är green {holeNumber}
          </button>
        </div>
      </div>
    </div>
  );
}
