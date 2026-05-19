'use client';

type Props = {
  holeNumber: number;
  par: number | null;
  length: number | null;
  hcpIndex: number | null;
  distanceToGreenMeters: number | null;
};

const formatDistance = (d: number) => (d < 30 ? `${d.toFixed(1)} m` : `${Math.round(d)} m`);

export function HoleHeader({ holeNumber, par, length, hcpIndex, distanceToGreenMeters }: Props) {
  return (
    <div className="absolute top-3 left-14 right-24 z-10 text-white pointer-events-none">
      <div className="inline-flex items-baseline gap-2 bg-slate-900/55 px-2.5 py-1 rounded-lg backdrop-blur-sm">
        <span className="text-xl font-extrabold">Hål {holeNumber}</span>
        <span className="text-xs font-semibold opacity-90">
          Par {par ?? '-'} · {length ?? '-'}m · HCP {hcpIndex ?? '-'}
        </span>
      </div>
      <div className="mt-1 inline-block bg-slate-900/55 px-2.5 py-0.5 rounded-md backdrop-blur-sm">
        <span className="text-xs font-bold">
          {distanceToGreenMeters === null
            ? 'Avstånd till green: —'
            : `${formatDistance(distanceToGreenMeters)} till green`}
        </span>
      </div>
    </div>
  );
}
