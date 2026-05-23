'use client';

import type { ServerRoundHoleScore, ServerRoundPlayer } from '@/lib/api';

type Props = {
  players: ServerRoundPlayer[];
  scoresByPlayer: Map<string, ServerRoundHoleScore | undefined>;
  isLastHole: boolean;
  saving?: boolean;
  onTapPlayer: (playerId: string) => void;
  onSubmit: () => void;
};

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ScoreChipBar({
  players,
  scoresByPlayer,
  isLastHole,
  saving = false,
  onTapPlayer,
  onSubmit
}: Props) {
  return (
    <div className="absolute left-0 right-0 bottom-0 z-10 bg-slate-900/90 rounded-t-2xl px-3 pt-3 pb-4 flex items-center gap-2">
      <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {players.map((p) => {
          const strokes = scoresByPlayer.get(p.id)?.strokes ?? null;
          return (
            <button
              key={p.id}
              onClick={() => onTapPlayer(p.id)}
              className="shrink-0 min-h-11 px-3 rounded-lg bg-white text-ink font-bold text-sm flex items-center gap-1.5"
              aria-label={`Sätt score för ${p.displayNameSnapshot}`}
            >
              <span className="text-slate-500">{initials(p.displayNameSnapshot)}</span>
              <span className="text-lg leading-none">{strokes ?? '—'}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onSubmit}
        disabled={saving}
        className="shrink-0 min-h-11 px-4 bg-primary text-white rounded-lg font-bold disabled:opacity-60"
      >
        {saving ? 'Sparar…' : isLastHole ? 'Avsluta' : 'Nästa hål'}
      </button>
    </div>
  );
}
