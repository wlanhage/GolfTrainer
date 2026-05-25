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

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-20" onClick={onClose} />

      {/* Club rail */}
      <div className="absolute right-12 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto">
        {clubs.map((club) => {
          const isLast = club.id === lastShotClub;
          return (
            <button
              key={club.id}
              onClick={() => onLogShot(club.id)}
              title={club.name}
              className={`w-10 h-10 rounded-lg shadow flex items-center justify-center text-xs font-bold transition-colors ${
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
