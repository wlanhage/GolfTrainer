import { HoleLayoutGeometry } from '../lib/types';

export function ProgressChecklist({ layout, par, length, hcpIndex }: { layout: HoleLayoutGeometry; par: number | null; length: number | null; hcpIndex: number | null }) {
  const fairwayPolygons = layout.fairwayPolygons ?? (layout.fairwayPolygon.length ? [layout.fairwayPolygon] : []);
  const checks = [
    { key: 'metadata', label: 'Metadata', ok: par !== null && length !== null && hcpIndex !== null },
    { key: 'tee', label: 'Tee', ok: Boolean(layout.teePoint) },
    { key: 'green', label: 'Green', ok: layout.greenPolygon.length >= 3 },
    { key: 'fairway', label: 'Fairway', ok: fairwayPolygons.some((polygon) => polygon.length >= 3) }
  ];

  const next = checks.find((item) => !item.ok);

  return (
    <div className="card">
      <h3>Progress</h3>
      {checks.map((item) => <p key={item.key} className={item.ok ? 'ok' : 'warn'}>{item.ok ? '✔' : '•'} {item.label}</p>)}
      <p className="small-note">Nästa steg: {next ? `Komplettera ${next.label}` : 'Hålet är komplett ✅'}</p>
    </div>
  );
}
