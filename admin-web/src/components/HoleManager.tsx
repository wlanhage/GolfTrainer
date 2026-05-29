'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAutosave } from '../hooks/useAutosave';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { computeHoleLength } from '../lib/holeMetrics';
import { courseRepo } from '../lib/storage';
import { Course, GeoPoint, HoleLayoutGeometry } from '../lib/types';
import { HoleEditorShell } from './hole-editor/HoleEditorShell';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Props = { initialCourse: Course };
type Layer = 'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob';
type Tool = 'select' | Layer;
type Selection = { layer: Layer; index: number; pointIndex?: number } | null;
type MapCenter = { lng: number; lat: number };
type MapPoint = { x: number; y: number };

type MapLibreMap = {
  on: (event: string, handler: () => void) => void;
  remove: () => void;
  getZoom: () => number;
  getCenter: () => MapCenter;
  project: (lngLat: [number, number]) => MapPoint;
  unproject: (point: [number, number]) => MapCenter;
  dragPan: { enable: () => void; disable: () => void };
  scrollZoom: { enable: () => void; disable: () => void };
  doubleClickZoom: { enable: () => void; disable: () => void };
  flyTo: (options: { center: [number, number]; zoom?: number; essential?: boolean }) => void;
  zoomTo: (zoom: number, options?: { around?: MapCenter; duration?: number }) => void;
};

type MapLibreCtor = new (options: {
  container: HTMLDivElement;
  style: unknown;
  center: [number, number];
  zoom: number;
  attributionControl?: boolean;
}) => MapLibreMap;

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAPLIBRE_CDN_VERSION = '5.3.0';
const MAPLIBRE_SCRIPT_ID = 'maplibre-gl-script';
const MAPLIBRE_CSS_ID = 'maplibre-gl-css';
const MIN_EDITOR_ZOOM = 2;
const MAX_EDITOR_ZOOM = 20;
const DEFAULT_CENTER: GeoPoint = { lat: 59.3293, lng: 18.0686 };
const MAX_FAIRWAY_POLYGONS = 3;
const UNSAVED_KEY = 'gt_admin_unsaved_changes_v1';

const rasterStyle = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles &copy; Esri',
    },
  },
  layers: [{ id: 'satellite-base', type: 'raster', source: 'satellite' }],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const closePolygon = (points: GeoPoint[]) => {
  if (points.length < 3) return [];
  const first = points[0];
  const last = points[points.length - 1];
  return first.lat === last.lat && first.lng === last.lng ? points : [...points, first];
};

const applyToLayer = (
  layout: HoleLayoutGeometry,
  layer: Layer,
  points: GeoPoint[],
  fairwayPolygons: GeoPoint[][]
): HoleLayoutGeometry => {
  if (layer === 'tee') return { ...layout, teePoint: points[0] ?? null };
  const polygon = closePolygon(points);
  if (layer === 'green') return { ...layout, greenPolygon: polygon };
  if (layer === 'fairway') {
    if (!polygon.length) return layout;
    const existing = fairwayPolygons.slice(0, MAX_FAIRWAY_POLYGONS);
    if (existing.length >= MAX_FAIRWAY_POLYGONS) return layout;
    const merged = [...existing, polygon];
    return { ...layout, fairwayPolygons: merged, fairwayPolygon: merged[0] ?? [] };
  }
  if (layer === 'bunker') return polygon.length ? { ...layout, bunkerPolygons: [...layout.bunkerPolygons, polygon] } : layout;
  if (layer === 'trees') return polygon.length ? { ...layout, treesPolygons: [...layout.treesPolygons, polygon] } : layout;
  return polygon.length ? { ...layout, obPolygons: [...layout.obPolygons, polygon] } : layout;
};

async function loadMapLibre() {
  if (typeof window === 'undefined') return null;
  const win = window as Window & { maplibregl?: { Map: MapLibreCtor } };
  if (win.maplibregl?.Map) return win.maplibregl;

  if (!document.getElementById(MAPLIBRE_CSS_ID)) {
    const link = document.createElement('link');
    link.id = MAPLIBRE_CSS_ID;
    link.rel = 'stylesheet';
    link.href = `https://unpkg.com/maplibre-gl@${MAPLIBRE_CDN_VERSION}/dist/maplibre-gl.css`;
    document.head.appendChild(link);
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(MAPLIBRE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if ((window as Window & { maplibregl?: { Map: MapLibreCtor } }).maplibregl?.Map) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Kunde inte ladda MapLibre-script.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = MAPLIBRE_SCRIPT_ID;
    script.src = `https://unpkg.com/maplibre-gl@${MAPLIBRE_CDN_VERSION}/dist/maplibre-gl.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Kunde inte ladda MapLibre-script.'));
    document.head.appendChild(script);
  });

  return win.maplibregl ?? null;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function HoleManager({ initialCourse }: Props) {
  const [course, setCourse] = useState<Course>(initialCourse);
  const [selectedHole, setSelectedHole] = useState(1);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [stroke, setStroke] = useState<GeoPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(17);
  const [manualCenter, setManualCenter] = useState<GeoPoint | null>(null);
  const [userPosition, setUserPosition] = useState<GeoPoint | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [undoStack, setUndoStack] = useState<HoleLayoutGeometry[]>([]);
  const [redoStack, setRedoStack] = useState<HoleLayoutGeometry[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragVertex, setDragVertex] = useState<Selection>(null);
  const [visibility, setVisibility] = useState<Record<Layer, boolean>>({
    tee: true, green: true, fairway: true, bunker: true, trees: true, ob: true,
  });
  const [locks, setLocks] = useState<Record<Layer, boolean>>({
    tee: false, green: false, fairway: false, bunker: false, trees: false, ob: false,
  });

  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const hole = useMemo(
    () => course.holes.find((h) => h.holeNumber === selectedHole)!,
    [course.holes, selectedHole]
  );

  const fairwayPolygons = useMemo(
    () => hole.layout.fairwayPolygons ?? (hole.layout.fairwayPolygon.length ? [hole.layout.fairwayPolygon] : []),
    [hole.layout.fairwayPolygon, hole.layout.fairwayPolygons]
  );

  const center = manualCenter ?? userPosition ?? DEFAULT_CENTER;

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPosition(next);
        setManualCenter((prev) => prev ?? next);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 5000 }
    );
  }, []);

  // Boot MapLibre
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!mapCanvasRef.current || mapRef.current) return;
      const maplibre = await loadMapLibre().catch(() => null);
      if (!maplibre?.Map || !mapCanvasRef.current || cancelled) return;

      const map = new maplibre.Map({
        container: mapCanvasRef.current,
        style: rasterStyle,
        center: [center.lng, center.lat],
        zoom,
        attributionControl: true,
      });

      mapRef.current = map;

      // Keep React state in sync with native map moves
      map.on('moveend', () => {
        const c = map.getCenter();
        setManualCenter({ lat: c.lat, lng: c.lng });
        setZoom(map.getZoom());
      });

      // MapLibre's scrollZoom is intentionally left ENABLED.
      // Pan and zoom are always on — Figma-style interaction model.
      // We do NOT intercept wheel events or toggle dragPan.
      map.on('load', () => {
        setMapReady(true);
      });
    };

    void boot();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to tee on hole switch
  const prevSelectedHoleRef = useRef(selectedHole);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (prevSelectedHoleRef.current === selectedHole && mapReady) return;
    prevSelectedHoleRef.current = selectedHole;
    const teePoint = hole.layout.teePoint;
    if (teePoint) {
      map.flyTo({ center: [teePoint.lng, teePoint.lat], zoom: Math.max(map.getZoom(), 16), essential: true });
    }
  }, [selectedHole, mapReady, hole.layout.teePoint]);

  // ── Autosave ──────────────────────────────────────────────────────────────

  const saveCourse = async (nextCourse: Course) => {
    const nextHole = nextCourse.holes.find((h) => h.holeNumber === selectedHole);
    if (!nextHole) return;
    await courseRepo.updateHole(nextCourse.id, nextHole.holeNumber, {
      par: nextHole.par,
      length: nextHole.length,
      hcpIndex: nextHole.hcpIndex,
      layout: nextHole.layout,
    });
  };

  const { saveState, lastSavedAt, saveNow } = useAutosave({ value: course, onSave: saveCourse, delay: 700 });
  useUnsavedChanges({ hasUnsavedChanges: saveState === 'unsaved' || saveState === 'saving' });

  useEffect(() => {
    const dirty = saveState === 'unsaved' || saveState === 'saving';
    window.localStorage.setItem(UNSAVED_KEY, dirty ? '1' : '0');
  }, [saveState]);

  // ── Hole data mutation ────────────────────────────────────────────────────

  const persistHole = (nextLayout: HoleLayoutGeometry, meta?: { par?: number | null; length?: number | null; hcpIndex?: number | null }) => {
    setCourse((prev) => ({
      ...prev,
      holes: prev.holes.map((h) =>
        h.holeNumber === hole.holeNumber ? { ...h, ...meta, layout: nextLayout } : h
      ),
    }));
  };

  const snapshotUndo = () => {
    setUndoStack((prev) => [...prev, hole.layout]);
    setRedoStack([]);
  };

  const teeToGreenMeters = useMemo(() => computeHoleLength(hole), [hole]);

  useEffect(() => {
    if (hole.length !== null || teeToGreenMeters === null) return;
    persistHole(hole.layout, { length: teeToGreenMeters });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hole.holeNumber, hole.layout, hole.length, teeToGreenMeters]);

  // ── Coordinate projection ─────────────────────────────────────────────────

  const toGeo = (clientX: number, clientY: number): GeoPoint | null => {
    const rect = mapCanvasRef.current?.getBoundingClientRect();
    const map = mapRef.current;
    if (!rect || !map) return null;
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    const next = map.unproject([x, y]);
    return { lng: next.lng, lat: next.lat };
  };

  const toCanvas = (point: GeoPoint) => {
    const map = mapRef.current;
    if (!map) return { x: -1000, y: -1000 };
    const projected = map.project([point.lng, point.lat]);
    return { x: projected.x, y: projected.y };
  };

  // ── Selection helpers ─────────────────────────────────────────────────────

  const readSelectedPolygon = (): GeoPoint[] | null => {
    if (!selection) return null;
    if (selection.layer === 'green') return hole.layout.greenPolygon;
    if (selection.layer === 'fairway') return fairwayPolygons[selection.index] ?? null;
    if (selection.layer === 'bunker') return hole.layout.bunkerPolygons[selection.index] ?? null;
    if (selection.layer === 'trees') return hole.layout.treesPolygons[selection.index] ?? null;
    if (selection.layer === 'ob') return hole.layout.obPolygons[selection.index] ?? null;
    return null;
  };

  const writeSelectedPolygon = (nextPolygon: GeoPoint[]) => {
    if (!selection) return;
    const next = { ...hole.layout };
    if (selection.layer === 'green') next.greenPolygon = nextPolygon;
    if (selection.layer === 'fairway') {
      const nextFairways = fairwayPolygons
        .map((p, i) => (i === selection.index ? nextPolygon : p))
        .slice(0, MAX_FAIRWAY_POLYGONS);
      next.fairwayPolygons = nextFairways;
      next.fairwayPolygon = nextFairways[0] ?? [];
    }
    if (selection.layer === 'bunker') next.bunkerPolygons = next.bunkerPolygons.map((p, i) => i === selection.index ? nextPolygon : p);
    if (selection.layer === 'trees') next.treesPolygons = next.treesPolygons.map((p, i) => i === selection.index ? nextPolygon : p);
    if (selection.layer === 'ob') next.obPolygons = next.obPolygons.map((p, i) => i === selection.index ? nextPolygon : p);
    persistHole(next);
  };

  // ── Drawing event handlers ────────────────────────────────────────────────

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragVertex) return;
    if (activeTool === 'select') return;
    if (locks[activeTool as Layer]) return;
    const geo = toGeo(event.clientX, event.clientY);
    if (!geo) return;
    setIsDrawing(true);
    setStroke([geo]);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragVertex && dragVertex.pointIndex !== undefined) {
      const geo = toGeo(event.clientX, event.clientY);
      if (!geo) return;
      const polygon = readSelectedPolygon();
      if (!polygon) return;
      const next = polygon.map((pt, i) => (i === dragVertex.pointIndex ? geo : pt));
      writeSelectedPolygon(next);
      return;
    }
    if (activeTool === 'select') return;
    if (!isDrawing) return;
    const geo = toGeo(event.clientX, event.clientY);
    if (!geo) return;
    setStroke((prev) => [...prev, geo]);
  };

  const completeStroke = () => {
    if (dragVertex) {
      setDragVertex(null);
      return;
    }
    if (activeTool === 'select') return;
    if (!isDrawing || stroke.length === 0) return;
    snapshotUndo();
    const next = applyToLayer(hole.layout, activeTool as Layer, stroke, fairwayPolygons);
    if (activeTool === 'fairway' && next === hole.layout) {
      // max fairways reached — silently drop (toast is shown in shell via onClearLayer path)
    } else {
      persistHole(next);
    }
    setStroke([]);
    setIsDrawing(false);
  };

  const cancelStroke = () => {
    setStroke([]);
    setIsDrawing(false);
    setDragVertex(null);
  };

  // ── Edit operations ───────────────────────────────────────────────────────

  const insertPoint = () => {
    const polygon = readSelectedPolygon();
    if (!polygon || polygon.length < 2) return;
    snapshotUndo();
    if (!selection?.pointIndex || selection.pointIndex <= 0) return;
    const index = selection.pointIndex;
    const a = polygon[index - 1];
    const b = polygon[index];
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    writeSelectedPolygon([...polygon.slice(0, index), mid, ...polygon.slice(index)]);
  };

  const simplify = () => {
    if (!selection || selection.layer === 'tee') return;
    const polygon = readSelectedPolygon();
    if (!polygon || polygon.length < 8) return;
    snapshotUndo();
    const closed =
      polygon[0].lat === polygon[polygon.length - 1].lat &&
      polygon[0].lng === polygon[polygon.length - 1].lng;
    const body = closed ? polygon.slice(0, -1) : polygon.slice();
    const simplified = body.filter((_, i) => i % 2 === 0);
    const candidate = simplified.length >= 3 ? simplified : body;
    writeSelectedPolygon(closed ? [...candidate, candidate[0]] : candidate);
  };

  const duplicate = () => {
    if (!selection || selection.layer === 'tee') return;
    const polygon = readSelectedPolygon();
    if (!polygon || polygon.length < 3) return;
    snapshotUndo();
    // Offset slightly
    const offset = 0.0002;
    const shifted = polygon.map((pt) => ({ lat: pt.lat + offset, lng: pt.lng + offset }));
    const next = { ...hole.layout };
    if (selection.layer === 'green') next.greenPolygon = shifted; // replace (only 1 green)
    if (selection.layer === 'fairway') {
      const nextFairways = [...fairwayPolygons, shifted].slice(0, MAX_FAIRWAY_POLYGONS);
      next.fairwayPolygons = nextFairways;
      next.fairwayPolygon = nextFairways[0] ?? [];
    }
    if (selection.layer === 'bunker') next.bunkerPolygons = [...next.bunkerPolygons, shifted];
    if (selection.layer === 'trees') next.treesPolygons = [...next.treesPolygons, shifted];
    if (selection.layer === 'ob') next.obPolygons = [...next.obPolygons, shifted];
    persistHole(next);
  };

  const deleteSelected = () => {
    if (!selection) return;
    if (selection.pointIndex !== undefined) {
      // Delete a single vertex
      const polygon = readSelectedPolygon();
      if (!polygon || polygon.length <= 4) return;
      snapshotUndo();
      writeSelectedPolygon(polygon.filter((_, i) => i !== selection.pointIndex));
      setSelection({ layer: selection.layer, index: selection.index });
      return;
    }
    snapshotUndo();
    const next = { ...hole.layout };
    if (selection.layer === 'tee') next.teePoint = null;
    if (selection.layer === 'green') next.greenPolygon = [];
    if (selection.layer === 'fairway') {
      const nextFairways = fairwayPolygons.filter((_, i) => i !== selection.index);
      next.fairwayPolygons = nextFairways;
      next.fairwayPolygon = nextFairways[0] ?? [];
    }
    if (selection.layer === 'bunker') next.bunkerPolygons = next.bunkerPolygons.filter((_, i) => i !== selection.index);
    if (selection.layer === 'trees') next.treesPolygons = next.treesPolygons.filter((_, i) => i !== selection.index);
    if (selection.layer === 'ob') next.obPolygons = next.obPolygons.filter((_, i) => i !== selection.index);
    setSelection(null);
    persistHole(next);
  };

  const clearLayer = () => {
    if (activeTool === 'select') return;
    snapshotUndo();
    const next = { ...hole.layout };
    if (activeTool === 'tee') next.teePoint = null;
    if (activeTool === 'green') next.greenPolygon = [];
    if (activeTool === 'fairway') { next.fairwayPolygons = []; next.fairwayPolygon = []; }
    if (activeTool === 'bunker') next.bunkerPolygons = [];
    if (activeTool === 'trees') next.treesPolygons = [];
    if (activeTool === 'ob') next.obPolygons = [];
    persistHole(next);
  };

  const resetAll = () => {
    snapshotUndo();
    persistHole({
      teePoint: null,
      greenPolygon: [],
      fairwayPolygon: [],
      fairwayPolygons: [],
      bunkerPolygons: [],
      treesPolygons: [],
      obPolygons: [],
    });
    setSelection(null);
    setStroke([]);
    setIsDrawing(false);
    setManualCenter(null);
    setZoom(17);
    const fallback = userPosition ?? DEFAULT_CENTER;
    mapRef.current?.flyTo({ center: [fallback.lng, fallback.lat], zoom: 17, essential: true });
  };

  const setMeta = (field: 'par' | 'length' | 'hcpIndex', value: string) => {
    const parsed = value.trim() ? Number(value) : null;
    persistHole(hole.layout, { [field]: parsed });
  };

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  const undo = () => {
    const prev = undoStack[undoStack.length - 1];
    if (!prev) return;
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, hole.layout]);
    persistHole(prev);
  };

  const redo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, hole.layout]);
    persistHole(next);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <HoleEditorShell
      course={course}
      selectedHole={selectedHole}
      activeTool={activeTool}
      stroke={stroke}
      isDrawing={isDrawing}
      undoStack={undoStack}
      redoStack={redoStack}
      selection={selection}
      dragVertex={dragVertex}
      visibility={visibility}
      locks={locks}
      saveState={saveState}
      lastSavedAt={lastSavedAt}
      teeToGreenMeters={teeToGreenMeters}
      mapReady={mapReady}
      mapCanvasRef={mapCanvasRef}
      mapRef={mapRef}
      onSelectHole={(n) => setSelectedHole(n)}
      onSelectTool={setActiveTool}
      onUndo={undo}
      onRedo={redo}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={completeStroke}
      onPointerLeave={cancelStroke}
      onCanvasClick={() => setSelection(null)}
      onSetMeta={setMeta}
      onToggleVisibility={(layer) => setVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }))}
      onToggleLock={(layer) => setLocks((prev) => ({ ...prev, [layer]: !prev[layer] }))}
      onInsertPoint={insertPoint}
      onSimplify={simplify}
      onDuplicate={duplicate}
      onDeleteSelected={deleteSelected}
      onClearLayer={clearLayer}
      onResetAll={resetAll}
      onSaveNow={async () => { const ok = await saveNow(); if (!ok) throw new Error('save failed'); }}
      readSelectedPolygon={readSelectedPolygon}
      toCanvas={toCanvas}
      setSelection={setSelection}
      setDragVertex={setDragVertex}
      fairwayPolygons={fairwayPolygons}
    />
  );
}
