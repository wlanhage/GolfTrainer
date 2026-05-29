'use client';

import { useState } from 'react';
import { Course, GeoPoint, HoleLayoutGeometry } from '../../lib/types';

type Layer = 'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob';
type Selection = { layer: Layer; index: number; pointIndex?: number } | null;

const LAYER_COLORS: Record<Layer, string> = {
  tee: '#ef4444',
  green: '#22c55e',
  fairway: '#16a34a',
  bunker: '#f59e0b',
  trees: '#15803d',
  ob: '#dc2626',
};

const LAYER_LABELS: Record<Layer, string> = {
  tee: 'Tee',
  green: 'Green',
  fairway: 'Fairway',
  bunker: 'Bunker',
  trees: 'Träd',
  ob: 'Out of bounds',
};

function layerMeta(layer: Layer, layout: HoleLayoutGeometry, fairwayPolygons: GeoPoint[][]): string {
  if (layer === 'tee') return layout.teePoint ? '1 punkt placerad' : 'Ej placerad';
  if (layer === 'green') {
    const n = layout.greenPolygon.filter((_, i, a) => i < a.length - 1 || a.length <= 1).length;
    return n >= 3 ? `${n} punkter` : 'Ej ritad';
  }
  if (layer === 'fairway') {
    const count = fairwayPolygons.length;
    if (count === 0) return 'Ej ritad';
    const pts = fairwayPolygons[0]?.length ?? 0;
    return count === 1 ? `${pts} punkter` : `${count} polygoner`;
  }
  if (layer === 'bunker') {
    const n = layout.bunkerPolygons.length;
    return n === 0 ? 'Ej ritad' : `${n} polygon${n === 1 ? '' : 'er'}`;
  }
  if (layer === 'trees') {
    const n = layout.treesPolygons.length;
    return n === 0 ? 'Ej ritad' : `${n} polygon${n === 1 ? '' : 'er'}`;
  }
  const n = layout.obPolygons.length;
  return n === 0 ? 'Ej ritad' : `${n} polygon${n === 1 ? '' : 'er'}`;
}

type InspectorProps = {
  hole: Course['holes'][number];
  fairwayPolygons: GeoPoint[][];
  teeToGreenMeters: number | null;
  selection: Selection;
  visibility: Record<Layer, boolean>;
  locks: Record<Layer, boolean>;
  onToggleVisibility: (layer: Layer) => void;
  onToggleLock: (layer: Layer) => void;
  onSetMeta: (field: 'par' | 'length' | 'hcpIndex', value: string) => void;
};

export function HoleEditorInspector({
  hole,
  fairwayPolygons,
  teeToGreenMeters,
  selection,
  visibility,
  locks,
  onToggleVisibility,
  onToggleLock,
  onSetMeta,
}: InspectorProps) {
  const [activeTab, setActiveTab] = useState<'hole' | 'layers' | 'quality'>('hole');

  const layout = hole.layout;

  // Quality checks
  const hasPar = hole.par !== null;
  const hasHcp = hole.hcpIndex !== null;
  const hasTee = Boolean(layout.teePoint);
  const hasGreen = layout.greenPolygon.length >= 3;
  const hasFairway = fairwayPolygons.some((p) => p.length >= 3);
  const teeGreenOk = teeToGreenMeters !== null && teeToGreenMeters > 50;

  const checks = [
    { key: 'par', label: 'Par satt', ok: hasPar, warn: false },
    { key: 'hcp', label: 'HCP satt', ok: hasHcp, warn: false },
    { key: 'tee', label: 'Tee placerad', ok: hasTee, warn: false },
    { key: 'green', label: 'Green ritad', ok: hasGreen, warn: false },
    { key: 'fairway', label: 'Fairway ritad', ok: hasFairway, warn: false },
    {
      key: 'length',
      label: 'Tee → Green > 50 m',
      ok: teeGreenOk,
      warn: teeToGreenMeters !== null && !teeGreenOk,
    },
  ];

  const doneCount = checks.filter((c) => c.ok).length;
  const warnCount = checks.filter((c) => c.warn).length;
  const pct = Math.round((doneCount / checks.length) * 100);

  const LAYERS: Layer[] = ['tee', 'green', 'fairway', 'bunker', 'trees', 'ob'];
  const totalLayerCount = LAYERS.reduce((sum, l) => {
    if (l === 'tee') return sum + (layout.teePoint ? 1 : 0);
    if (l === 'green') return sum + (layout.greenPolygon.length >= 3 ? 1 : 0);
    if (l === 'fairway') return sum + fairwayPolygons.filter((p) => p.length >= 3).length;
    if (l === 'bunker') return sum + layout.bunkerPolygons.length;
    if (l === 'trees') return sum + layout.treesPolygons.length;
    return sum + layout.obPolygons.length;
  }, 0);

  return (
    <aside className="he-inspector">
      <div className="he-insp-tabs">
        <button
          className={`he-insp-tab${activeTab === 'hole' ? ' active' : ''}`}
          onClick={() => setActiveTab('hole')}
        >
          Hål
        </button>
        <button
          className={`he-insp-tab${activeTab === 'layers' ? ' active' : ''}`}
          onClick={() => setActiveTab('layers')}
        >
          Lager{' '}
          <span className="count">{totalLayerCount}</span>
        </button>
        <button
          className={`he-insp-tab${activeTab === 'quality' ? ' active' : ''}`}
          onClick={() => setActiveTab('quality')}
        >
          Kvalitet{' '}
          <span
            className="count"
            style={
              warnCount > 0
                ? { background: 'rgba(245,158,11,0.18)', color: '#fcd34d' }
                : undefined
            }
          >
            {warnCount > 0 ? warnCount : doneCount}
          </span>
        </button>
      </div>

      <div className="he-insp-body">
        {activeTab === 'hole' && (
          <>
            {/* Metadata */}
            <section className="he-insp-section">
              <h4>Metadata</h4>
              <div className="he-meta-grid">
                <div className="he-field">
                  <label>Par</label>
                  <input
                    type="number"
                    value={hole.par ?? ''}
                    onChange={(e) => onSetMeta('par', e.target.value)}
                    placeholder="–"
                  />
                </div>
                <div className="he-field">
                  <label>Längd (m)</label>
                  <input
                    type="number"
                    value={hole.length ?? ''}
                    onChange={(e) => onSetMeta('length', e.target.value)}
                    placeholder="–"
                  />
                </div>
                <div className="he-field">
                  <label>HCP</label>
                  <input
                    type="number"
                    value={hole.hcpIndex ?? ''}
                    onChange={(e) => onSetMeta('hcpIndex', e.target.value)}
                    placeholder="–"
                  />
                </div>
              </div>
              <div className="he-meta-row">
                <span>Tee → Green (beräknad)</span>
                <strong>{teeToGreenMeters !== null ? `${teeToGreenMeters} m` : '–'}</strong>
              </div>
            </section>

            {/* Layers preview */}
            <section className="he-insp-section">
              <h4>Lager</h4>
              {LAYERS.map((layer) => (
                <LayerRow
                  key={layer}
                  layer={layer}
                  meta={layerMeta(layer, layout, fairwayPolygons)}
                  selected={selection?.layer === layer}
                  visible={visibility[layer]}
                  locked={locks[layer]}
                  onToggleVisibility={() => onToggleVisibility(layer)}
                  onToggleLock={() => onToggleLock(layer)}
                />
              ))}
            </section>
          </>
        )}

        {activeTab === 'layers' && (
          <section className="he-insp-section" style={{ marginTop: 0 }}>
            <h4>Lager</h4>
            {LAYERS.map((layer) => (
              <LayerRow
                key={layer}
                layer={layer}
                meta={layerMeta(layer, layout, fairwayPolygons)}
                selected={selection?.layer === layer}
                visible={visibility[layer]}
                locked={locks[layer]}
                onToggleVisibility={() => onToggleVisibility(layer)}
                onToggleLock={() => onToggleLock(layer)}
              />
            ))}
          </section>
        )}

        {activeTab === 'quality' && (
          <section className="he-insp-section" style={{ marginTop: 0 }}>
            <h4>Kvalitet</h4>
            <div className="he-quality-summary">
              <div className="he-ring" style={{ '--pct': pct } as React.CSSProperties}>
                <span>{pct}%</span>
              </div>
              <div className="he-qmeta">
                <strong>
                  {doneCount} av {checks.length} klart
                </strong>
                <small>
                  {warnCount > 0
                    ? `${warnCount} varning${warnCount > 1 ? 'ar' : ''} att åtgärda`
                    : 'Inga varningar'}
                </small>
              </div>
            </div>
            <div className="he-checklist">
              {checks.map((c) => (
                <div
                  key={c.key}
                  className={`he-check${c.ok ? ' done' : c.warn ? ' warn' : ' todo'}`}
                >
                  <span className="mark">{c.ok ? '✓' : c.warn ? '!' : '·'}</span>
                  {c.label}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

function LayerRow({
  layer,
  meta,
  selected,
  visible,
  locked,
  onToggleVisibility,
  onToggleLock,
}: {
  layer: Layer;
  meta: string;
  selected: boolean;
  visible: boolean;
  locked: boolean;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
}) {
  return (
    <div className={`he-layer${selected ? ' selected' : ''}`}>
      <span
        className="swatch-lg"
        style={{ background: LAYER_COLORS[layer] }}
      />
      <div className="name">
        <span className="label">{LAYER_LABELS[layer]}</span>
        <span className="meta">{meta}</span>
      </div>
      <button
        className={`ico${locked ? '' : ' off'}`}
        title={locked ? 'Lås upp' : 'Lås'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock();
        }}
      >
        {locked ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 1 1 8 0v4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 4-4 4 4 0 0 1 4 4" />
          </svg>
        )}
      </button>
      <button
        className={`ico${visible ? '' : ' off'}`}
        title={visible ? 'Synlig' : 'Dold'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <path d="M1 1l22 22" />
          </svg>
        )}
      </button>
    </div>
  );
}
