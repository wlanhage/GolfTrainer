'use client';

import { getCaddyClubShortLabel } from '@/lib/caddyClubs';
import type { CaddyClub } from '@/lib/types';

type Props = {
  hasCaddyData: boolean;
  clubsWithData: CaddyClub[];
  isOpen: boolean;
  onToggle: () => void;
  selectedClubId: string;
  onSelectClub: (clubId: string) => void;
  autoSelectedClubId: string | null;
  showAutoBadge: boolean;
  showResetAuto: boolean;
  onResetAuto: () => void;
};

export function HeatmapRail({
  hasCaddyData,
  clubsWithData,
  isOpen,
  onToggle,
  selectedClubId,
  onSelectClub,
  autoSelectedClubId,
  showAutoBadge,
  showResetAuto,
  onResetAuto
}: Props) {
  if (!hasCaddyData) return null;

  if (!isOpen) return null;

  return (
    <div className="absolute right-11 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1 max-h-[70vh] overflow-y-auto py-2 px-1 bg-slate-900/70 rounded-l-lg">
      {clubsWithData.map((club) => {
        const active = club.id === selectedClubId;
        const isAuto = showAutoBadge && autoSelectedClubId === club.id;
        return (
          <button
            key={club.id}
            onClick={() => onSelectClub(club.id)}
            className={`relative w-10 h-8 rounded-md border text-xs font-extrabold flex items-center justify-center ${
              active ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-slate-300 text-ink'
            } ${isAuto ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900/70' : ''}`}
          >
            {getCaddyClubShortLabel(club.id)}
            {isAuto ? (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-[8px] font-black text-slate-900 rounded px-1 leading-tight">
                AUTO
              </span>
            ) : null}
          </button>
        );
      })}
      {showResetAuto ? (
        <button
          onClick={onResetAuto}
          className="mt-1 px-1 py-1 rounded-md bg-amber-400 text-slate-900 text-[10px] font-extrabold leading-tight"
          title="Återgå till auto-vald klubba"
        >
          ÅTER
        </button>
      ) : null}
    </div>
  );
}
