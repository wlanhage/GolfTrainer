import { Hole } from '../../lib/types';
import { holeStatus } from './holeStatus';

export function HoleStrip({
  holes,
  selectedHole,
  onSelect
}: {
  holes: Hole[];
  selectedHole: number;
  onSelect: (holeNumber: number) => void;
}) {
  const sorted = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);
  const index = sorted.findIndex((h) => h.holeNumber === selectedHole);
  const prev = sorted[index - 1];
  const next = sorted[index + 1];

  return (
    <div className="hole-strip">
      <button
        className="hole-strip-arrow"
        disabled={!prev}
        onClick={() => prev && onSelect(prev.holeNumber)}
        aria-label="Föregående hål"
      >
        ‹
      </button>

      <div className="hole-strip-track">
        {sorted.map((hole) => {
          const status = holeStatus(hole);
          const isActive = hole.holeNumber === selectedHole;
          return (
            <button
              key={hole.id}
              className={`hole-pill ${isActive ? 'is-active' : ''} status-${status}`}
              onClick={() => onSelect(hole.holeNumber)}
              title={`Hål ${hole.holeNumber} — ${status === 'complete' ? 'klart' : status === 'partial' ? 'påbörjat' : 'tomt'}`}
            >
              <span className="hole-pill-num">{hole.holeNumber}</span>
              <span className={`hole-pill-dot status-${status}`} />
            </button>
          );
        })}
      </div>

      <button
        className="hole-strip-arrow"
        disabled={!next}
        onClick={() => next && onSelect(next.holeNumber)}
        aria-label="Nästa hål"
      >
        ›
      </button>
    </div>
  );
}
