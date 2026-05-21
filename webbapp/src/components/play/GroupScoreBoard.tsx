'use client';

import { useMemo } from 'react';
import type { ServerRoundHole, ServerRoundHoleScore, ServerRoundPlayer, ServerWolfRole } from '@/lib/api';
import type { RoundFormatKey } from '@/lib/types';
import { getFormat } from '@/lib/playFormats';
import { stablefordPoints, wolfHolePoints } from '@/lib/scoring';

type Props = {
  format: RoundFormatKey;
  players: ServerRoundPlayer[];
  roundHole: ServerRoundHole;
  par: number | null;
  scoresByPlayer: Map<string, ServerRoundHoleScore | undefined>;
  onChangeStrokes: (playerId: string, strokes: number | null) => void;
  onChangeWolfRole?: (playerId: string, role: ServerWolfRole | null) => void;
  saving?: boolean;
};

const STROKE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function GroupScoreBoard({
  format,
  players,
  par,
  scoresByPlayer,
  onChangeStrokes,
  onChangeWolfRole,
  saving = false
}: Props) {
  const formatDef = getFormat(format);
  const isStableford = formatDef.scoring === 'stableford';
  const isWolf = formatDef.scoring === 'wolf';

  // För Wolf — pre-räkna poäng per spelare
  const wolfPoints = useMemo(() => {
    if (!isWolf) return null;
    const wolfInputs = players.map((p) => {
      const s = scoresByPlayer.get(p.id);
      return {
        playerId: p.id,
        role: (s?.wolfRole ?? 'OPPONENT') as 'WOLF' | 'PARTNER' | 'OPPONENT',
        strokes: s?.strokes ?? null
      };
    });
    return wolfHolePoints(wolfInputs);
  }, [isWolf, players, scoresByPlayer]);

  return (
    <div className="flex flex-col gap-2">
      {players.map((p) => {
        const score = scoresByPlayer.get(p.id);
        const strokes = score?.strokes ?? null;
        const points = isStableford ? stablefordPoints(strokes, par) : null;
        const wolfPts = wolfPoints?.[p.id] ?? null;
        const wolfRole = score?.wolfRole ?? null;

        return (
          <div key={p.id} className="card flex items-center gap-3">
            <span className="font-bold text-ink truncate flex-1">{p.displayNameSnapshot}</span>

            {isWolf && onChangeWolfRole ? (
              <select
                value={wolfRole ?? ''}
                onChange={(e) => onChangeWolfRole(p.id, (e.target.value || null) as ServerWolfRole | null)}
                className="text-xs border rounded px-1 py-1"
              >
                <option value="">–</option>
                <option value="WOLF">Wolf</option>
                <option value="PARTNER">Partner</option>
                <option value="OPPONENT">Mot</option>
              </select>
            ) : null}

            <select
              value={strokes ?? ''}
              onChange={(e) => onChangeStrokes(p.id, e.target.value === '' ? null : Number(e.target.value))}
              disabled={saving}
              className="text-base border rounded px-2 py-1 w-16 text-center font-semibold"
            >
              <option value="">–</option>
              {STROKE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            {isStableford && points !== null ? (
              <span className="text-sm font-bold text-primary w-8 text-right">{points}p</span>
            ) : null}
            {isWolf && wolfPts !== null ? (
              <span className="text-sm font-bold text-primary w-8 text-right">{wolfPts}p</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
