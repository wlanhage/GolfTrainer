'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { Map as MlMap, MapMouseEvent } from 'maplibre-gl';
import type { GeoPoint, HoleLayoutGeometry, HoleLayoutLayer } from '@/lib/types';
import { hasRequiredLayout, resolveHoleAxis, resolveLayoutMappingStatus } from '@/lib/holeGeometry';
import { HOLE_COLORS } from '@/lib/holeColors';

const DEFAULT_CENTER: GeoPoint = { lat: 59.3293, lng: 18.0686 };
const TILE_STYLE = 'https://demotiles.maplibre.org/style.json';

const LAYERS: { key: HoleLayoutLayer; label: string }[] = [
  { key: 'tee', label: 'TEE' },
  { key: 'green', label: 'GREEN' },
  { key: 'fairway', label: 'FAIRWAY' },
  { key: 'bunker', label: 'BUNKER' },
  { key: 'trees', label: 'TREES' },
  { key: 'ob', label: 'OB' }
];

const initialCenter = (g: HoleLayoutGeometry): GeoPoint => {
  if (g.teePoint) return g.teePoint;
  if (g.greenPolygon[0]) return g.greenPolygon[0];
  if (g.fairwayPolygon[0]) return g.fairwayPolygon[0];
  return DEFAULT_CENTER;
};

const toPolygon = (id: string, points: GeoPoint[], color: string) =>
  points.length >= 3
    ? {
        type: 'Feature' as const,
        id,
        properties: { color },
        geometry: { type: 'Polygon' as const, coordinates: [points.map((p) => [p.lng, p.lat])] }
      }
    : null;

const buildFC = (g: HoleLayoutGeometry, drafts: GeoPoint[]): GeoJSON.FeatureCollection => {
  const features: GeoJSON.Feature[] = [];
  const green = toPolygon('green', g.greenPolygon, HOLE_COLORS.green);
  if (green) features.push(green);
  const fairway = toPolygon('fairway', g.fairwayPolygon, HOLE_COLORS.fairway);
  if (fairway) features.push(fairway);
  g.bunkerPolygons.forEach((p, i) => {
    const f = toPolygon(`bunker_${i}`, p, HOLE_COLORS.bunker);
    if (f) features.push(f);
  });
  g.treesPolygons.forEach((p, i) => {
    const f = toPolygon(`trees_${i}`, p, HOLE_COLORS.trees);
    if (f) features.push(f);
  });
  g.obPolygons.forEach((p, i) => {
    const f = toPolygon(`ob_${i}`, p, HOLE_COLORS.ob);
    if (f) features.push(f);
  });
  if (g.teePoint) {
    features.push({
      type: 'Feature',
      id: 'tee',
      properties: { color: HOLE_COLORS.tee },
      geometry: { type: 'Point', coordinates: [g.teePoint.lng, g.teePoint.lat] }
    });
  }
  if (drafts.length >= 2) {
    features.push({
      type: 'Feature',
      id: 'draft-line',
      properties: { color: HOLE_COLORS.draft },
      geometry: { type: 'LineString', coordinates: drafts.map((p) => [p.lng, p.lat]) }
    });
  }
  drafts.forEach((p, i) =>
    features.push({
      type: 'Feature',
      id: `draft-${i}`,
      properties: { color: HOLE_COLORS.draft },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
    })
  );
  return { type: 'FeatureCollection', features };
};

const applyToLayer = (g: HoleLayoutGeometry, layer: HoleLayoutLayer, polygon: GeoPoint[]): HoleLayoutGeometry => {
  switch (layer) {
    case 'green':
      return { ...g, greenPolygon: polygon };
    case 'fairway':
      return { ...g, fairwayPolygon: polygon };
    case 'bunker':
      return polygon.length ? { ...g, bunkerPolygons: [...g.bunkerPolygons, polygon] } : g;
    case 'trees':
      return polygon.length ? { ...g, treesPolygons: [...g.treesPolygons, polygon] } : g;
    case 'ob':
      return polygon.length ? { ...g, obPolygons: [...g.obPolygons, polygon] } : g;
    default:
      return g;
  }
};

const clearLayer = (g: HoleLayoutGeometry, layer: HoleLayoutLayer): HoleLayoutGeometry => {
  switch (layer) {
    case 'tee':
      return { ...g, teePoint: null };
    case 'green':
      return { ...g, greenPolygon: [] };
    case 'fairway':
      return { ...g, fairwayPolygon: [] };
    case 'bunker':
      return { ...g, bunkerPolygons: [] };
    case 'trees':
      return { ...g, treesPolygons: [] };
    case 'ob':
      return { ...g, obPolygons: [] };
    default:
      return g;
  }
};

type Props = {
  geometry: HoleLayoutGeometry;
  onChange: (g: HoleLayoutGeometry) => void;
  onSave?: () => void;
};

export function HoleLayoutEditor({ geometry, onChange, onSave }: Props) {
  const [activeLayer, setActiveLayer] = useState<HoleLayoutLayer>('tee');
  const [mode, setMode] = useState<'navigate' | 'draw'>('navigate');
  const [drafts, setDrafts] = useState<GeoPoint[]>([]);
  const [undoStack, setUndoStack] = useState<HoleLayoutGeometry[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);

  const axis = useMemo(() => resolveHoleAxis(geometry), [geometry]);
  const initial = useMemo(() => initialCenter(geometry), [geometry]);
  const fc = useMemo(() => buildFC(geometry, drafts), [geometry, drafts]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: [initial.lng, initial.lat],
      zoom: 16,
      attributionControl: false
    });
    map.on('load', () => {
      map.addSource('hole-edit', { type: 'geojson', data: fc });
      map.addLayer({ id: 'edit-polys', type: 'fill', source: 'hole-edit', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': ['get', 'color'] } });
      map.addLayer({ id: 'edit-line', type: 'line', source: 'hole-edit', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': ['get', 'color'], 'line-width': 3 } });
      map.addLayer({ id: 'edit-points', type: 'circle', source: 'hole-edit', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': ['get', 'color'], 'circle-radius': 6 } });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const src = map.getSource('hole-edit') as maplibregl.GeoJSONSource | undefined;
      src?.setData(fc);
    };
    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [fc]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: MapMouseEvent) => {
      if (mode !== 'draw') return;
      const point: GeoPoint = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      if (activeLayer === 'tee') {
        setUndoStack((s) => [...s, structuredClone(geometry)]);
        onChange({ ...geometry, teePoint: point });
        return;
      }
      setDrafts((d) => [...d, point]);
    };
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [mode, activeLayer, geometry, onChange]);

  const finishPolygon = () => {
    if (drafts.length < 3) return;
    setUndoStack((s) => [...s, structuredClone(geometry)]);
    onChange(applyToLayer(geometry, activeLayer, drafts));
    setDrafts([]);
  };

  return (
    <div className="bg-white border border-border rounded-xl p-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {LAYERS.map((l) => (
          <button
            key={l.key}
            onClick={() => {
              setActiveLayer(l.key);
              setDrafts([]);
              // Auto-switcha till draw-mode när användaren väljer ett lager — då börjar man typiskt rita.
              setMode('draw');
            }}
            className={`border-2 rounded-lg px-2.5 py-1.5 text-xs font-bold ${activeLayer === l.key ? 'bg-primary border-primary text-white' : 'border-primary bg-white text-primary'}`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setMode('navigate')} className={`flex-1 border-2 rounded-lg py-2 font-semibold ${mode === 'navigate' ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary'}`}>Navigate</button>
        <button onClick={() => setMode('draw')} className={`flex-1 border-2 rounded-lg py-2 font-semibold ${mode === 'draw' ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary'}`}>Draw</button>
      </div>

      {activeLayer !== 'tee' && mode === 'draw' ? (
        <div className="flex gap-2">
          <button onClick={() => setDrafts((d) => d.slice(0, -1))} className="flex-1 btn-secondary py-2 text-sm">Ångra punkt</button>
          <button onClick={() => setDrafts([])} className="flex-1 btn-secondary py-2 text-sm">Rensa utkast</button>
          <button onClick={finishPolygon} disabled={drafts.length < 3} className="flex-1 btn-primary py-2 text-sm disabled:opacity-50">Slutför polygon</button>
        </div>
      ) : null}

      {!hasRequiredLayout(geometry) ? (
        <p className="text-amber-700 font-semibold text-sm">
          TEE och GREEN krävs. Status: {resolveLayoutMappingStatus(geometry)}
        </p>
      ) : null}
      {axis ? (
        <p className="text-xs text-slate-600">Bearing {axis.bearing.toFixed(1)}° • Length {Math.round(axis.lengthMeters)} m</p>
      ) : null}

      <div ref={containerRef} className="relative h-80 rounded-lg overflow-hidden bg-slate-200" />

      <div className="flex gap-2">
        <button
          onClick={() => {
            const latest = undoStack[undoStack.length - 1];
            if (!latest) return;
            onChange(latest);
            setUndoStack((s) => s.slice(0, -1));
          }}
          disabled={undoStack.length === 0}
          className="flex-1 btn-secondary py-2.5 text-sm disabled:opacity-50"
        >
          Undo
        </button>
        <button
          onClick={() => {
            setUndoStack((s) => [...s, structuredClone(geometry)]);
            onChange(clearLayer(geometry, activeLayer));
            setDrafts([]);
          }}
          className="flex-1 btn-secondary py-2.5 text-sm"
        >
          Clear active
        </button>
        {onSave ? (
          <button onClick={onSave} className="flex-1 btn-primary py-2.5 text-sm">
            Save
          </button>
        ) : null}
      </div>

      <p className="text-xs text-slate-500 font-bold">Layout status: {resolveLayoutMappingStatus(geometry)}</p>
    </div>
  );
}
