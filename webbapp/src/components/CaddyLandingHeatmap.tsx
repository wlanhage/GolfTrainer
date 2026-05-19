'use client';

import { HEATMAP_BIN_SIZE_METERS, HEATMAP_GRID_SIZE } from '@/lib/heatmapConfig';

type LandingPoint = { x: number; y: number };
type HeatmapCell = { id: string; row: number; col: number; count: number; percentage: number };

const GRID_SIZE = HEATMAP_GRID_SIZE;
const BIN_SIZE_METERS = HEATMAP_BIN_SIZE_METERS;

const getCellColor = (intensity: number) => {
  if (intensity <= 0) return '#f1f5f9';
  if (intensity < 0.2) return '#f3e8e8';
  if (intensity < 0.4) return '#f0f1d9';
  if (intensity < 0.6) return '#dfee9a';
  if (intensity < 0.8) return '#bbeb6c';
  return '#8fe869';
};

const getBinIndex = (value: number) => {
  const half = Math.floor(GRID_SIZE / 2);
  const raw = Math.round(value / BIN_SIZE_METERS);
  return Math.max(-half, Math.min(half, raw)) + half;
};

export function CaddyLandingHeatmap({
  points,
  onCellPress
}: {
  points: LandingPoint[];
  onCellPress?: (cell: HeatmapCell) => void;
}) {
  const total = points.length;
  if (total === 0) {
    return (
      <div className="border border-border rounded-lg p-3 bg-slate-50 text-sm text-slate-500">
        Ingen slagdata ännu – lägg till slag för att visa heatmap.
      </div>
    );
  }

  const counts: number[][] = Array.from({ length: GRID_SIZE }).map(() => Array.from({ length: GRID_SIZE }).map(() => 0));
  for (const p of points) {
    const col = getBinIndex(p.x);
    const rowFromBottom = getBinIndex(p.y);
    const row = GRID_SIZE - 1 - rowFromBottom;
    counts[row][col] += 1;
  }
  let maxCount = 1;
  for (const r of counts) for (const v of r) if (v > maxCount) maxCount = v;

  return (
    <div className="flex flex-col gap-2">
      <div className="border border-slate-300 bg-slate-200 p-1.5 inline-block self-start">
        {counts.map((row, rowIndex) => (
          <div key={rowIndex} className="flex">
            {row.map((count, colIndex) => {
              const percentage = Math.round((count / total) * 100);
              const cell = { id: `${rowIndex}-${colIndex}`, row: rowIndex, col: colIndex, count, percentage };
              return (
                <button
                  key={cell.id}
                  onClick={() => count > 0 && onCellPress?.(cell)}
                  style={{ backgroundColor: getCellColor(count / maxCount) }}
                  className="w-9 h-9 m-0.5 rounded flex items-center justify-center text-[10px] font-semibold text-ink"
                >
                  {count > 0 ? `${percentage}%` : ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Tryck på en ruta för detaljer.</p>
    </div>
  );
}
