'use client';

import { Camera, PlusCircle } from 'lucide-react';

type Props = {
  /** Whether heatmap data exists (show heatmap toggle) */
  hasCaddyData: boolean;
  heatmapOpen: boolean;
  onToggleHeatmap: () => void;
  /** Shot tracking */
  shotTrackingEnabled: boolean;
  onShotTracking: () => void;
  /** Camera recommend */
  onCameraRecommend: () => void;
};

export function RightActionRail({
  hasCaddyData,
  heatmapOpen,
  onToggleHeatmap,
  shotTrackingEnabled,
  onShotTracking,
  onCameraRecommend,
}: Props) {
  const showHeatmap = hasCaddyData;
  const showShot = shotTrackingEnabled;
  // Always show camera
  const hasAny = showHeatmap || showShot || true;
  if (!hasAny) return null;

  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-end gap-2">
      {/* Heatmap toggle */}
      {showHeatmap && (
        <button
          onClick={onToggleHeatmap}
          aria-label={heatmapOpen ? 'Dölj caddy heatmap' : 'Visa caddy heatmap'}
          aria-pressed={heatmapOpen}
          className={`w-10 h-10 rounded-l-lg shadow-lg flex items-center justify-center text-lg font-black border-l border-y border-slate-300 ${
            heatmapOpen ? 'bg-green-600 text-white border-green-700' : 'bg-white/95 text-ink'
          }`}
        >
          ▦
        </button>
      )}

      {/* Shot tracking toggle */}
      {showShot && (
        <button
          onClick={onShotTracking}
          aria-label="Logga slag"
          className="w-10 h-10 rounded-l-lg shadow-lg bg-white/95 flex items-center justify-center text-green-700 border-l border-y border-slate-300"
        >
          <PlusCircle size={22} aria-hidden="true" />
        </button>
      )}

      {/* Camera recommend */}
      <button
        onClick={onCameraRecommend}
        aria-label="Kamera klubbrekommendation"
        className="w-10 h-10 rounded-l-lg shadow-lg bg-white/95 flex items-center justify-center text-slate-700 border-l border-y border-slate-300"
      >
        <Camera size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
