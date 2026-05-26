'use client';

import { getCaddyClubShortLabel } from '@/lib/caddyClubs';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  clubs: Array<{ id: string; name: string }>;
  onLogShot: (clubId: string) => void;
  lastShotClub?: string | null;
};

export function ShotTrackingRail({ isOpen, onClose, clubs, onLogShot, lastShotClub }: Props) {
  if (!isOpen) return null;

  // Calculate grid columns based on club count (aim for 3-4 columns)
  const cols = clubs.length <= 6 ? 3 : 4;

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-20" onClick={onClose} />

      {/* Club grid */}
      <div
        className="absolute right-12 top-1/2 -translate-y-1/2 z-30 bg-slate-900/80 backdrop-blur-sm rounded-xl p-2 shadow-xl"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '6px' }}
      >
        {clubs.map((club) => {
          const isLast = club.id === lastShotClub;
          return (
            <button
              key={club.id}
              onClick={() => onLogShot(club.id)}
              title={club.name}
              className={`w-12 h-11 rounded-lg shadow flex items-center justify-center text-xs font-bold transition-colors ${
                isLast
                  ? 'bg-primary text-white'
                  : 'bg-white text-slate-700 active:bg-slate-100'
              }`}
            >
              {getCaddyClubShortLabel(club.id)}
            </button>
          );
        })}
      </div>
    </>
  );
}
