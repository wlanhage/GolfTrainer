'use client';

import type { GreenDistances } from '@/lib/holeGeometry';

type Props = {
  holeNumber: number;
  par: number | null;
  length: number | null;
  hcpIndex: number | null;
  greenDistances: GreenDistances | null;
};

const formatDistance = (d: number) => (d < 30 ? d.toFixed(1) : String(Math.round(d)));

export function HoleHeader({ holeNumber, par, length, hcpIndex, greenDistances }: Props) {
  const InfoRow = ({ children, large }: { children: React.ReactNode; large?: boolean }) => (
    <div className="bg-slate-900/55 px-2.5 py-0.5 rounded-md backdrop-blur-sm w-fit">
      <span className={large ? 'text-base font-extrabold' : 'text-sm font-semibold'}>{children}</span>
    </div>
  );

  return (
    <>
      {/* Hole info column — below back button, top-left */}
      <div className="absolute top-16 left-3 z-10 flex flex-col gap-1 text-white pointer-events-none">
        <InfoRow large>Hål {holeNumber}</InfoRow>
        {par !== null ? <InfoRow>Par {par}</InfoRow> : null}
        {length !== null ? <InfoRow>{length} m</InfoRow> : null}
        {hcpIndex !== null ? <InfoRow>HCP {hcpIndex}</InfoRow> : null}
      </div>

      {/* Distance to green — top center between back and FABs */}
      <div className="absolute top-3 left-16 right-28 z-10 flex justify-center pointer-events-none">
        <div className="bg-slate-900/65 px-4 py-2 rounded-xl backdrop-blur-sm text-white text-center">
          <div className="text-[10px] uppercase tracking-wider font-bold opacity-80">
            Avstånd till green
          </div>
          <div className="flex items-baseline justify-center gap-3 mt-0.5">
            <span className="text-sm font-bold">
              F:{' '}
              <span className="text-lg font-extrabold">
                {greenDistances?.front != null ? formatDistance(greenDistances.front) : '—'}
              </span>
            </span>
            <span className="text-sm font-bold">
              M:{' '}
              <span className="text-lg font-extrabold">
                {greenDistances?.middle != null ? formatDistance(greenDistances.middle) : '—'}
              </span>
            </span>
            <span className="text-sm font-bold">
              B:{' '}
              <span className="text-lg font-extrabold">
                {greenDistances?.back != null ? formatDistance(greenDistances.back) : '—'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
