import { HoleLayoutGeometry } from '../lib/types';

export function ValidationPanel({ layout, length }: { layout: HoleLayoutGeometry; length: number | null }) {
  const items = [
    { ok: Boolean(layout.teePoint), text: 'Tee satt' },
    { ok: layout.greenPolygon.length >= 3, text: 'Green polygon finns' },
    { ok: layout.fairwayPolygon.length >= 3, text: 'Fairway polygon finns' },
    { ok: length === null || (length > 30 && length < 900), text: 'Rimlig hållängd' }
  ];

  return (
    <div className="card">
      <h3>Validering</h3>
      {items.map((item) => <p key={item.text} className={item.ok ? 'ok' : 'warn'}>{item.ok ? '✔' : '⚠'} {item.text}</p>)}
    </div>
  );
}
