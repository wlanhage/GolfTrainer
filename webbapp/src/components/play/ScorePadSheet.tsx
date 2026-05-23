'use client';

import type { ServerRoundPlayer } from '@/lib/api';

type Props = {
  open: boolean;
  player: ServerRoundPlayer | null;
  holeNumber: number;
  par: number | null;
  currentStrokes: number | null;
  onClose: () => void;
  onSubmit: (strokes: number | null) => void;
};

const PRIMARY_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function ScorePadSheet({
  open,
  player,
  holeNumber,
  par,
  currentStrokes,
  onClose,
  onSubmit
}: Props) {
  if (!open || !player) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/80 flex flex-col"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="mt-auto w-full bg-slate-100 rounded-t-3xl p-4 flex flex-col gap-3 max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-ink leading-tight truncate">
              {player.displayNameSnapshot}
            </p>
            <p className="text-sm text-slate-500">
              Hål {holeNumber}
              {par !== null ? ` · Par ${par}` : ''}
              {currentStrokes !== null ? ` · Nu: ${currentStrokes}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-600 shrink-0"
            aria-label="Stäng"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 grid grid-cols-3 grid-rows-4 gap-2 min-h-0">
          {PRIMARY_DIGITS.map((n) => (
            <button
              key={n}
              onClick={() => onSubmit(n)}
              className="bg-white text-ink rounded-2xl text-3xl font-extrabold active:bg-slate-200"
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => onSubmit(null)}
            className="bg-white text-slate-600 rounded-2xl text-sm font-bold active:bg-slate-200"
          >
            Rensa
          </button>
          <button
            onClick={() => onSubmit(10)}
            className="bg-white text-ink rounded-2xl text-3xl font-extrabold active:bg-slate-200"
          >
            10
          </button>
          <button
            onClick={onClose}
            className="bg-white text-slate-600 rounded-2xl text-sm font-bold active:bg-slate-200"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}
