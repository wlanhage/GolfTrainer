'use client';

import { X, Trash2 } from 'lucide-react';
import { caddyClubs, getCaddyClubShortLabel } from '@/lib/caddyClubs';

export type ReviewShot = {
  id: string;
  shotOrder: number;
  clubId: string;
  distanceMeters: number | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  shots: ReviewShot[];
  score: number | null;
  putts: number | null;
  onChangeClub: (shotId: string, clubId: string) => void;
  onDeleteShot: (shotId: string) => void;
};

// All clubs including putter (only available in this review)
const allClubsForReview = [
  ...caddyClubs,
  { id: 'putter', name: 'Putter' },
];

export function ShotReviewSheet({ isOpen, onClose, shots, score, putts, onChangeClub, onDeleteShot }: Props) {
  if (!isOpen) return null;

  const loggedCount = shots.length;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 max-h-[75vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-800">Slag på detta hål</h3>
          <button onClick={onClose} className="text-slate-400">
            <X size={24} />
          </button>
        </div>

        {/* Summary pill */}
        <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-slate-50 rounded-xl">
          <span className="text-sm font-semibold text-slate-700">
            {loggedCount} loggade slag
          </span>
          {score !== null && putts !== null && putts >= 0 && (
            <span className="text-sm text-slate-500">
              ⛳ {putts} {putts === 1 ? 'putt' : 'puttar'}
            </span>
          )}
        </div>

        {/* Shot list */}
        {shots.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Inga slag loggade på detta hål.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {shots.map((shot, idx) => (
              <div
                key={shot.id}
                className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl"
              >
                {/* Shot number */}
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                  {idx + 1}
                </div>

                {/* Club selector */}
                <select
                  value={shot.clubId}
                  onChange={(e) => onChangeClub(shot.id, e.target.value)}
                  className="flex-1 text-sm font-semibold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
                >
                  {allClubsForReview.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>

                {/* Distance */}
                {shot.distanceMeters !== null && (
                  <span className="text-xs text-slate-400 font-medium">
                    {Math.round(shot.distanceMeters)}m
                  </span>
                )}

                {/* Delete */}
                <button
                  onClick={() => onDeleteShot(shot.id)}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Putt explanation */}
        {score !== null && loggedCount > 0 && putts !== null && putts > 0 && (
          <p className="text-xs text-slate-400 mt-3 text-center">
            {score} slag totalt − {loggedCount} loggade = {putts} {putts === 1 ? 'putt' : 'puttar'}
          </p>
        )}

        <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold">
          Stäng
        </button>
      </div>
    </div>
  );
}
