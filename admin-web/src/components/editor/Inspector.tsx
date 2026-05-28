import { Hole } from '../../lib/types';
import { holeChecks } from './holeStatus';
import { Layer, LAYER_BY_KEY, LayerGlyph } from './layers';

type Selection = { layer: Layer; index: number; pointIndex?: number } | null;

export function Inspector({
  hole,
  teeToGreenMeters,
  onMeta,
  selection,
  selectedPointCount,
  onSimplify,
  onInsertPoint,
  onDeletePoint,
  onDeleteSelected,
  onResetHole
}: {
  hole: Hole;
  teeToGreenMeters: number | null;
  onMeta: (field: 'par' | 'length' | 'hcpIndex', value: string) => void;
  selection: Selection;
  selectedPointCount: number;
  onSimplify: () => void;
  onInsertPoint: () => void;
  onDeletePoint: () => void;
  onDeleteSelected: () => void;
  onResetHole: () => void;
}) {
  const checks = holeChecks(hole);
  const checklist = [
    { key: 'metadata', label: 'Metadata (par, längd, HCP)', ok: checks.metadata },
    { key: 'tee', label: 'Tee placerad', ok: checks.tee },
    { key: 'green', label: 'Green ritad', ok: checks.green },
    { key: 'fairway', label: 'Fairway ritad', ok: checks.fairway },
    { key: 'length', label: 'Rimlig hållängd', ok: checks.length }
  ];
  const doneCount = checklist.filter((item) => item.ok).length;
  const progress = Math.round((doneCount / checklist.length) * 100);

  const selectedDef = selection ? LAYER_BY_KEY[selection.layer] : null;
  const isPolygon = selection ? selection.layer !== 'tee' : false;
  const hasVertex = selection?.pointIndex !== undefined && selection.pointIndex > 0;

  return (
    <aside className="inspector">
      {selection && selectedDef ? (
        <section className="inspector-card selection-card" style={{ ['--layer' as string]: selectedDef.color }}>
          <div className="inspector-card-head">
            <span className="tool-swatch sm" style={{ background: selectedDef.color }}>
              <LayerGlyph layer={selection.layer} size={13} />
            </span>
            <div>
              <h3>{selectedDef.label}{isPolygon ? ` #${selection.index + 1}` : ''}</h3>
              <p className="small-note">
                {selection.pointIndex !== undefined
                  ? `Punkt ${selection.pointIndex + 1} markerad`
                  : isPolygon
                    ? `${selectedPointCount} punkter`
                    : 'Markerad'}
              </p>
            </div>
          </div>
          {isPolygon ? (
            <>
              <p className="small-note">Dra i de vita punkterna på kartan för att forma om figuren.</p>
              <div className="inspector-actions">
                <button className="chip" onClick={onInsertPoint} disabled={!hasVertex}>Infoga punkt</button>
                <button className="chip" onClick={onDeletePoint} disabled={selection.pointIndex === undefined}>Ta bort punkt</button>
                <button className="chip" onClick={onSimplify}>Förenkla</button>
              </div>
            </>
          ) : null}
          <button className="chip danger full" onClick={onDeleteSelected}>Ta bort {selectedDef.label.toLowerCase()}</button>
        </section>
      ) : (
        <section className="inspector-card hint-card">
          <h3>Inget markerat</h3>
          <p className="small-note">Välj ett verktyg till vänster för att rita, eller klicka på en figur på kartan för att redigera den.</p>
        </section>
      )}

      <section className="inspector-card">
        <h3>Hålinfo</h3>
        <div className="meta-grid">
          <label>
            <span>Par</span>
            <input inputMode="numeric" placeholder="—" value={hole.par ?? ''} onChange={(event) => onMeta('par', event.target.value)} />
          </label>
          <label>
            <span>Längd (m)</span>
            <input inputMode="numeric" placeholder="—" value={hole.length ?? ''} onChange={(event) => onMeta('length', event.target.value)} />
          </label>
          <label>
            <span>HCP</span>
            <input inputMode="numeric" placeholder="—" value={hole.hcpIndex ?? ''} onChange={(event) => onMeta('hcpIndex', event.target.value)} />
          </label>
        </div>
        <p className="measure-row">
          <span>Tee → Green</span>
          <strong>{teeToGreenMeters ? `${teeToGreenMeters} m` : '—'}</strong>
        </p>
      </section>

      <section className="inspector-card">
        <div className="inspector-card-head spread">
          <h3>Checklista</h3>
          <span className="progress-tag">{doneCount}/{checklist.length}</span>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        <ul className="checklist">
          {checklist.map((item) => (
            <li key={item.key} className={item.ok ? 'ok' : 'todo'}>
              <span className="check-mark">{item.ok ? '✓' : ''}</span>
              {item.label}
            </li>
          ))}
        </ul>
      </section>

      <button className="chip danger ghost full" onClick={onResetHole}>Rensa hela hålet</button>
    </aside>
  );
}
