import { HoleLayoutGeometry } from '../lib/types';

export function LayerPanel({
  visibility,
  locks,
  onToggle,
  onToggleLock,
  layout
}: {
  visibility: Record<'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob', boolean>;
  locks: Record<'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob', boolean>;
  onToggle: (layer: 'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob') => void;
  onToggleLock: (layer: 'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob') => void;
  layout: HoleLayoutGeometry;
}) {
  const rows = [
    { key: 'tee', count: layout.teePoint ? 1 : 0 },
    { key: 'green', count: layout.greenPolygon.length ? 1 : 0 },
    { key: 'fairway', count: layout.fairwayPolygons?.length ?? (layout.fairwayPolygon.length ? 1 : 0) },
    { key: 'bunker', count: layout.bunkerPolygons.length },
    { key: 'trees', count: layout.treesPolygons.length },
    { key: 'ob', count: layout.obPolygons.length }
  ] as const;

  return (
    <div className="card">
      <h3>Lager</h3>
      {rows.map((row) => (
        <div key={row.key} className="layer-row">
          <label>
            <input type="checkbox" checked={visibility[row.key]} onChange={() => onToggle(row.key)} />
            <span>{row.key.toUpperCase()} ({row.count})</span>
          </label>
          <button className="chip" onClick={() => onToggleLock(row.key)}>{locks[row.key] ? 'Lås upp' : 'Lås'}</button>
        </div>
      ))}
    </div>
  );
}
