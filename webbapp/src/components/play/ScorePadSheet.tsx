'use client';

import { useEffect, useState } from 'react';
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

const MAX_STROKES = 99;

export function ScorePadSheet({
  open,
  player,
  holeNumber,
  par,
  currentStrokes,
  onClose,
  onSubmit
}: Props) {
  const [entry, setEntry] = useState<string>('');

  useEffect(() => {
    if (open) setEntry(currentStrokes !== null ? String(currentStrokes) : '');
  }, [open, currentStrokes]);

  if (!open || !player) return null;

  const pushDigit = (d: number) => {
    setEntry((prev) => {
      const next = prev + String(d);
      const n = Number(next);
      if (!Number.isFinite(n) || n > MAX_STROKES) return prev;
      // Strip leading zeros så "04" blir "4"
      return String(n);
    });
  };

  const backspace = () => {
    setEntry((prev) => prev.slice(0, -1));
  };

  const submit = () => {
    if (entry === '') {
      onSubmit(null);
    } else {
      const n = Number(entry);
      onSubmit(Number.isFinite(n) ? n : null);
    }
  };

  const Digit = ({ value }: { value: number }) => (
    <button
      onClick={() => pushDigit(value)}
      className="aspect-square bg-white text-ink rounded-2xl text-3xl font-extrabold active:bg-slate-200"
    >
      {value}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/80 flex flex-col"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="mt-auto w-full bg-slate-100 rounded-t-3xl p-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-extrabold text-ink leading-tight">
              {player.displayNameSnapshot}
            </p>
            <p className="text-sm text-slate-500">
              Hål {holeNumber}
              {par !== null ? ` · Par ${par}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl text-slate-600"
            aria-label="Stäng"
          >
            ✕
          </button>
        </div>

        <div className="bg-white rounded-2xl py-6 text-center text-5xl font-extrabold text-primary">
          {entry === '' ? <span className="text-slate-300">—</span> : entry}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Digit value={1} />
          <Digit value={2} />
          <Digit value={3} />
          <Digit value={4} />
          <Digit value={5} />
          <Digit value={6} />
          <Digit value={7} />
          <Digit value={8} />
          <Digit value={9} />
          <button
            onClick={backspace}
            className="aspect-square bg-white text-slate-600 rounded-2xl text-2xl font-bold active:bg-slate-200"
            aria-label="Radera siffra"
          >
            ←
          </button>
          <button
            onClick={() => pushDigit(0)}
            className="aspect-square bg-white text-ink rounded-2xl text-3xl font-extrabold active:bg-slate-200"
          >
            0
          </button>
          <button
            onClick={submit}
            className="aspect-square bg-primary text-white rounded-2xl text-2xl font-extrabold active:opacity-90"
            aria-label="Klar"
          >
            ✓
          </button>
        </div>
      </div>
    </div>
  );
}
