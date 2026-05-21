'use client';

import { useState, type TouchEvent } from 'react';
import type { PlayFormat } from '@/lib/playFormats';

type Props = {
  formats: PlayFormat[];
  selectedKey: PlayFormat['key'];
  onSelect: (key: PlayFormat['key']) => void;
};

export function FormatCarousel({ formats, selectedKey, onSelect }: Props) {
  const [index, setIndex] = useState(() => {
    const i = formats.findIndex((f) => f.key === selectedKey);
    return i >= 0 ? i : 0;
  });
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(formats.length - 1, i));
    setIndex(clamped);
    onSelect(formats[clamped].key);
  };

  const handleTouchStart = (e: TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) goTo(index + 1);
    else goTo(index - 1);
    setTouchStartX(null);
  };

  const active = formats[index];

  return (
    <div className="flex flex-col gap-3">
      <div
        className="card flex flex-col items-center text-center gap-3 select-none touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <span className="text-6xl">{active.icon}</span>
        <h2 className="text-2xl font-extrabold text-ink">{active.name}</h2>
        <p className="text-slate-700 text-sm leading-relaxed">{active.description}</p>
        <div className="flex gap-1.5 mt-1">
          {formats.map((_, i) => (
            <span
              key={i}
              className={`block rounded-full ${i === index ? 'bg-primary w-3 h-2' : 'bg-slate-300 w-2 h-2'}`}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="flex-1 btn-secondary disabled:opacity-50"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === formats.length - 1}
          className="flex-1 btn-secondary disabled:opacity-50"
        >
          →
        </button>
      </div>
    </div>
  );
}
