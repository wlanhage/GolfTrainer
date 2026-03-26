'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAutosave } from '../hooks/useAutosave';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { computeHoleLength } from '../lib/holeMetrics';
import { courseRepo } from '../lib/storage';
import { Course, GeoPoint, HoleLayoutGeometry } from '../lib/types';
import { EditorToolbar } from './EditorToolbar';
import { LayerPanel } from './LayerPanel';
import { ProgressChecklist } from './ProgressChecklist';
import { ValidationPanel } from './ValidationPanel';
import { ConfirmDialog } from './common/ConfirmDialog';
import { EmptyState } from './common/EmptyState';
import { PageHeader } from './common/PageHeader';
import { useToast } from './common/ToastProvider';

type Props = { initialCourse: Course };
type Layer = 'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob';
type Tool = 'pan' | Layer;
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

const MAPLIBRE_CDN_VERSION = '5.3.0';
const MAPLIBRE_SCRIPT_ID = 'maplibre-gl-script';
const MAPLIBRE_CSS_ID = 'maplibre-gl-css';
const MIN_EDITOR_ZOOM = 2;
const MAX_EDITOR_ZOOM = 20;

const DEFAULT_CENTER: GeoPoint = { lat: 59.3293, lng: 18.0686 };
const TOOLTIP_KEY = 'gt_admin_editor_seen_tooltips_v1';
const UNSAVED_KEY = 'gt_admin_unsaved_changes_v1';

const closePolygon = (points: GeoPoint[]) => {
  if (points.length < 3) return [];
  const first = points[0];
  const last = points[points.length - 1];
  return first.lat === last.lat && first.lng === last.lng ? points : [...points, first];
};

const applyToLayer = (layout: HoleLayoutGeometry, layer: Layer, points: GeoPoint[]): HoleLayoutGeometry => {
  if (layer === 'tee') return { ...layout, teePoint: points[0] ?? null };
  const polygon = closePolygon(points);
  if (layer === 'green') return { ...layout, greenPolygon: polygon };
  if (layer === 'fairway') return { ...layout, fairwayPolygon: polygon };
  if (layer === 'bunker') return polygon.length ? { ...layout, bunkerPolygons: [...layout.bunkerPolygons, polygon] } : layout;
  if (layer === 'trees') return polygon.length ? { ...layout, treesPolygons: [...layout.treesPolygons, polygon] } : layout;
  return polygon.length ? { ...layout, obPolygons: [...layout.obPolygons, polygon] } : layout;
};

const layerPalette: Record<Layer, string> = { tee: '#ef4444', green: '#22c55e', fairway: '#16a34a', bunker: '#f59e0b', trees: '#15803d', ob: '#dc2626' };

const rasterStyle = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles &copy; Esri'
    }
  },
  layers: [{ id: 'satellite-base', type: 'raster', source: 'satellite' }]
};

const loadMapLibre = async () => {
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
};

export function HoleManager({ initialCourse }: Props) {
  const { push } = useToast();
  const [course, setCourse] = useState<Course>(initialCourse);
  const [selectedHole, setSelectedHole] = useState(1);
  const [activeTool, setActiveTool] = useState<Tool>('pan');
  const [stroke, setStroke] = useState<GeoPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(17);
  const [manualCenter, setManualCenter] = useState<GeoPoint | null>(null);
  const [userPosition, setUserPosition] = useState<GeoPoint | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [undoStack, setUndoStack] = useState<HoleLayoutGeometry[]>([]);
  const [redoStack, setRedoStack] = useState<HoleLayoutGeometry[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragVertex, setDragVertex] = useState<Selection>(null);
  const [showTooltips, setShowTooltips] = useState(false);
  const [visibility, setVisibility] = useState<Record<Layer, boolean>>({ tee: true, green: true, fairway: true, bunker: true, trees: true, ob: true });
  const [locks, setLocks] = useState<Record<Layer, boolean>>({ tee: false, green: false, fairway: false, bunker: false, trees: false, ob: false });
  const boardRef = useRef<HTMLDivElement | null>(null);
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    const seen = window.localStorage.getItem(TOOLTIP_KEY);
    setShowTooltips(!seen);
  }, []);

  const hole = useMemo(() => course.holes.find((candidate) => candidate.holeNumber === selectedHole)!, [course.holes, selectedHole]);
  const center = manualCenter ?? userPosition ?? DEFAULT_CENTER;

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserPosition(nextPos);
        setManualCenter((prev) => prev ?? nextPos);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 5000 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootMap = async () => {
      if (!mapCanvasRef.current || mapRef.current) return;
      const maplibre = await loadMapLibre().catch(() => null);
      if (!maplibre?.Map || !mapCanvasRef.current || cancelled) {
        push('MapLibre kunde inte laddas.', 'error');
        return;
      }

      const map = new maplibre.Map({
        container: mapCanvasRef.current,
        style: rasterStyle,
        center: [center.lng, center.lat],
        zoom,
        attributionControl: true
      });

      mapRef.current = map;
      setMapReady(true);
      map.on('move', () => {
        const movedCenter = map.getCenter();
        setManualCenter({ lat: movedCenter.lat, lng: movedCenter.lng });
        setZoom(map.getZoom());
      });

      map.on('load', () => {
        map.scrollZoom.enable();
      });
    };

    void bootMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (activeTool === 'pan') {
      map.dragPan.enable();
      map.doubleClickZoom.enable();
    } else {
      map.dragPan.disable();
      map.doubleClickZoom.disable();
    }
  }, [activeTool]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const targetCenter = userPosition ?? DEFAULT_CENTER;
    setManualCenter(targetCenter);
    setZoom(17);
    map.flyTo({ center: [targetCenter.lng, targetCenter.lat], zoom: 17, essential: true });
  }, [mapReady, selectedHole, userPosition]);

  const saveCourse = async (nextCourse: Course) => {
    const nextHole = nextCourse.holes.find((entry) => entry.holeNumber === selectedHole);
    if (!nextHole) return;

    await courseRepo.updateHole(nextCourse.id, nextHole.holeNumber, {
      par: nextHole.par,
      length: nextHole.length,
      hcpIndex: nextHole.hcpIndex,
      layout: nextHole.layout
    });
  };

  const { saveState, lastSavedAt, saveNow } = useAutosave({ value: course, onSave: saveCourse, delay: 700 });
  useUnsavedChanges({ hasUnsavedChanges: saveState === 'unsaved' || saveState === 'saving' });

  useEffect(() => {
    const dirty = saveState === 'unsaved' || saveState === 'saving';
    window.localStorage.setItem(UNSAVED_KEY, dirty ? '1' : '0');
  }, [saveState]);

  const persistHole = (nextLayout: HoleLayoutGeometry, meta?: { par?: number | null; length?: number | null; hcpIndex?: number | null }) => {
    setCourse((prev) => ({
      ...prev,
      holes: prev.holes.map((h) => h.holeNumber === hole.holeNumber ? { ...h, ...meta, layout: nextLayout } : h)
    }));
  };

  const snapshotUndo = () => {
    setUndoStack((prev) => [...prev, hole.layout]);
    setRedoStack([]);
  };

  const toGeo = (clientX: number, clientY: number): GeoPoint | null => {
    const rect = boardRef.current?.getBoundingClientRect();
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

  const readSelectedPolygon = (): GeoPoint[] | null => {
    if (!selection) return null;
    if (selection.layer === 'green') return hole.layout.greenPolygon;
    if (selection.layer === 'fairway') return hole.layout.fairwayPolygon;
    if (selection.layer === 'bunker') return hole.layout.bunkerPolygons[selection.index] ?? null;
    if (selection.layer === 'trees') return hole.layout.treesPolygons[selection.index] ?? null;
    if (selection.layer === 'ob') return hole.layout.obPolygons[selection.index] ?? null;
    return null;
  };

  const writeSelectedPolygon = (nextPolygon: GeoPoint[]) => {
    if (!selection) return;
    const next = { ...hole.layout };
    if (selection.layer === 'green') next.greenPolygon = nextPolygon;
    if (selection.layer === 'fairway') next.fairwayPolygon = nextPolygon;
    if (selection.layer === 'bunker') next.bunkerPolygons = next.bunkerPolygons.map((polygon, index) => index === selection.index ? nextPolygon : polygon);
    if (selection.layer === 'trees') next.treesPolygons = next.treesPolygons.map((polygon, index) => index === selection.index ? nextPolygon : polygon);
    if (selection.layer === 'ob') next.obPolygons = next.obPolygons.map((polygon, index) => index === selection.index ? nextPolygon : polygon);
    persistHole(next);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragVertex) return;
    if (activeTool !== 'pan' && locks[activeTool]) {
      push(`${activeTool.toUpperCase()} är låst`, 'error');
      return;
    }
    if (activeTool === 'pan') return;
    const geo = toGeo(event.clientX, event.clientY);
    if (!geo) return;
    setIsDrawing(true);
    setStroke([geo]);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragVertex && dragVertex.pointIndex !== undefined) {
      const geo = toGeo(event.clientX, event.clientY);
      if (!geo) return;
      const polygon = readSelectedPolygon();
      if (!polygon) return;
      const next = polygon.map((point, index) => index === dragVertex.pointIndex ? geo : point);
      writeSelectedPolygon(next);
      return;
    }

    if (activeTool === 'pan') return;

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
    if (activeTool === 'pan') return;
    if (!isDrawing || stroke.length === 0) return;
    snapshotUndo();
    const next = applyToLayer(hole.layout, activeTool, stroke);
    persistHole(next);
    setStroke([]);
    setIsDrawing(false);
  };

  const insertPoint = () => {
    const polygon = readSelectedPolygon();
    if (!polygon || polygon.length < 2) return;
    snapshotUndo();
    const a = polygon[0];
    const b = polygon[1];
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    writeSelectedPolygon([a, mid, ...polygon.slice(1)]);
    push('Punkt infogad', 'success');
  };

  const deletePoint = () => {
    if (!selection || selection.pointIndex === undefined) return;
    const polygon = readSelectedPolygon();
    if (!polygon || polygon.length <= 4) {
      push('Polygon behöver minst 3 punkter', 'error');
      return;
    }
    snapshotUndo();
    writeSelectedPolygon(polygon.filter((_, index) => index !== selection.pointIndex));
    setSelection({ layer: selection.layer, index: selection.index });
    push('Punkt borttagen', 'info');
  };

  const deleteSelected = () => {
    if (!selection) return;
    if (selection.pointIndex !== undefined) {
      deletePoint();
      return;
    }

    snapshotUndo();
    const next = { ...hole.layout };
    if (selection.layer === 'tee') next.teePoint = null;
    if (selection.layer === 'green') next.greenPolygon = [];
    if (selection.layer === 'fairway') next.fairwayPolygon = [];
    if (selection.layer === 'bunker') next.bunkerPolygons = next.bunkerPolygons.filter((_, i) => i !== selection.index);
    if (selection.layer === 'trees') next.treesPolygons = next.treesPolygons.filter((_, i) => i !== selection.index);
    if (selection.layer === 'ob') next.obPolygons = next.obPolygons.filter((_, i) => i !== selection.index);
    setSelection(null);
    persistHole(next);
    push('Valt objekt borttaget', 'info');
  };

  const setMeta = (field: 'par' | 'length' | 'hcpIndex', value: string) => {
    const parsed = value.trim() ? Number(value) : null;
    persistHole(hole.layout, { [field]: parsed });
  };

  const teeToGreenMeters = useMemo(() => computeHoleLength(hole), [hole]);

  useEffect(() => {
    if (hole.length !== null || teeToGreenMeters === null) return;
    persistHole(hole.layout, { length: teeToGreenMeters });
  }, [hole.holeNumber, hole.layout, hole.length, teeToGreenMeters]);

  const drawPolygon = (polygon: GeoPoint[], color: string, key: string, onClick: () => void, selected: boolean) => {
    if (polygon.length < 3) return null;
    const points = polygon.map((p) => { const pos = toCanvas(p); return `${pos.x},${pos.y}`; }).join(' ');
    return <polygon key={key} points={points} fill={`${color}66`} stroke={selected ? '#111827' : color} strokeWidth={selected ? 4 : 2} onClick={(event) => { event.stopPropagation(); onClick(); }} />;
  };

  const renderHandles = () => {
    const polygon = readSelectedPolygon();
    if (!polygon) return null;
    return polygon.map((point, pointIndex) => {
      const pos = toCanvas(point);
      return (
        <circle
          key={`handle_${pointIndex}`}
          cx={pos.x}
          cy={pos.y}
          r={5}
          fill="#fff"
          stroke="#111827"
          strokeWidth={2}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (!selection) return;
            setSelection({ ...selection, pointIndex });
            setDragVertex({ ...selection, pointIndex });
          }}
        />
      );
    });
  };

  return (
    <>
      <PageHeader title={`Editor · ${course.courseName}`} description="Välj hål, fyll metadata och rita layout. Nästa steg visas i valideringspanelen." />

      <div className="course-workspace">
        <aside className="left-column">
          <div className="course-mini-panel">
            <label>Välj hål</label>
            <select value={selectedHole} onChange={(event) => setSelectedHole(Number(event.target.value))}>
              {course.holes.map((h) => <option key={h.id} value={h.holeNumber}>Hål {h.holeNumber}</option>)}
            </select>
            <div className="hole-list">
              <button className="chip" disabled={selectedHole <= 1} onClick={() => setSelectedHole((n) => n - 1)}>Föregående</button>
              <button className="chip" disabled={selectedHole >= course.holeCount} onClick={() => setSelectedHole((n) => n + 1)}>Nästa</button>
            </div>
          </div>

          <div className="metadata-panel">
            <h2>Metadata</h2>
            <input placeholder="Par" value={hole.par ?? ''} onChange={(event) => setMeta('par', event.target.value)} />
            <input placeholder="Längd" value={hole.length ?? ''} onChange={(event) => setMeta('length', event.target.value)} />
            <input placeholder="HCP" value={hole.hcpIndex ?? ''} onChange={(event) => setMeta('hcpIndex', event.target.value)} />
            <p>Tee → Green (Turf.js): <strong>{teeToGreenMeters ? `${teeToGreenMeters} m` : 'saknas data'}</strong></p>
            <p className="small-note">Kartkälla: MapLibre GL + Esri World Imagery (satellit).</p>
          </div>

          <LayerPanel
            layout={hole.layout}
            visibility={visibility}
            locks={locks}
            onToggle={(layer) => setVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }))}
            onToggleLock={(layer) => setLocks((prev) => ({ ...prev, [layer]: !prev[layer] }))}
          />
          <ValidationPanel layout={hole.layout} length={hole.length} />
          <ProgressChecklist layout={hole.layout} par={hole.par} length={hole.length} hcpIndex={hole.hcpIndex} />
        </aside>

        <section className="builder-panel">
          <EditorToolbar
            active={activeTool}
            onSelect={setActiveTool}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={() => {
              const prev = undoStack[undoStack.length - 1];
              if (!prev) return;
              setUndoStack((stack) => stack.slice(0, -1));
              setRedoStack((stack) => [...stack, hole.layout]);
              persistHole(prev);
            }}
            onRedo={() => {
              const next = redoStack[redoStack.length - 1];
              if (!next) return;
              setRedoStack((stack) => stack.slice(0, -1));
              setUndoStack((stack) => [...stack, hole.layout]);
              persistHole(next);
            }}
            onClearActiveLayer={() => setConfirmClear(true)}
            onSaveNow={async () => {
              const ok = await saveNow();
              push(ok ? 'Banan sparad' : 'Kunde inte spara banan', ok ? 'success' : 'error');
            }}
            saveState={saveState}
            lastSavedAt={lastSavedAt}
          />

          {showTooltips ? (
            <div className="empty-state">
              <h3>Snabbguide</h3>
              <p>1) Välj hål 2) Fyll metadata 3) Placera tee 4) Rita green/fairway.</p>
              <button onClick={() => { setShowTooltips(false); window.localStorage.setItem(TOOLTIP_KEY, '1'); }}>Förstått</button>
            </div>
          ) : null}

          {!hole.layout.teePoint && !hole.layout.greenPolygon.length ? (
            <EmptyState title="Starta hål-layout" description="Börja med att placera tee, sedan rita green och fairway." action={<button onClick={() => setActiveTool('tee')}>Placera tee</button>} />
          ) : null}

          <div
            ref={boardRef}
            className="draw-board large"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={completeStroke}
            onPointerLeave={completeStroke}
            onDoubleClick={completeStroke}
            tabIndex={0}
            onClick={() => setSelection(null)}
            style={{ cursor: activeTool === 'pan' ? 'grab' : 'crosshair' }}
            onWheel={(event) => {
              const map = mapRef.current;
              if (!map || !boardRef.current) return;
              event.preventDefault();
              const rect = boardRef.current.getBoundingClientRect();
              const x = event.clientX - rect.left;
              const y = event.clientY - rect.top;
              const around = map.unproject([x, y]);
              const delta = event.deltaY > 0 ? -0.35 : 0.35;
              const nextZoom = Math.max(MIN_EDITOR_ZOOM, Math.min(MAX_EDITOR_ZOOM, map.getZoom() + delta));
              map.zoomTo(nextZoom, { around, duration: 0 });
            }}
            onKeyDown={(event) => {
              if (event.key.toLowerCase() === 'v') setActiveTool('pan');
              if (event.key.toLowerCase() === 't') setActiveTool('tee');
              if (event.key.toLowerCase() === 'g') setActiveTool('green');
              if (event.key.toLowerCase() === 'f') setActiveTool('fairway');
              if (event.key === 'Escape') { setStroke([]); setIsDrawing(false); setSelection(null); }
              if (event.key === 'Delete') deleteSelected();
              if (event.key === 'Enter') completeStroke();
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                const prev = undoStack[undoStack.length - 1];
                if (!prev) return;
                setUndoStack((stack) => stack.slice(0, -1));
                setRedoStack((stack) => [...stack, hole.layout]);
                persistHole(prev);
              }
            }}
          >
            <div ref={mapCanvasRef} className="map-canvas" />
            <svg style={{ pointerEvents: activeTool === 'pan' ? 'none' : 'auto' }}>
              {visibility.green ? drawPolygon(hole.layout.greenPolygon, layerPalette.green, 'green', () => setSelection({ layer: 'green', index: 0 }), selection?.layer === 'green') : null}
              {visibility.fairway ? drawPolygon(hole.layout.fairwayPolygon, layerPalette.fairway, 'fairway', () => setSelection({ layer: 'fairway', index: 0 }), selection?.layer === 'fairway') : null}
              {visibility.bunker ? hole.layout.bunkerPolygons.map((polygon, index) => drawPolygon(polygon, layerPalette.bunker, `bunker_${index}`, () => setSelection({ layer: 'bunker', index }), selection?.layer === 'bunker' && selection.index === index)) : null}
              {visibility.trees ? hole.layout.treesPolygons.map((polygon, index) => drawPolygon(polygon, layerPalette.trees, `trees_${index}`, () => setSelection({ layer: 'trees', index }), selection?.layer === 'trees' && selection.index === index)) : null}
              {visibility.ob ? hole.layout.obPolygons.map((polygon, index) => drawPolygon(polygon, layerPalette.ob, `ob_${index}`, () => setSelection({ layer: 'ob', index }), selection?.layer === 'ob' && selection.index === index)) : null}
              {visibility.tee && hole.layout.teePoint ? (() => {
                const tee = toCanvas(hole.layout.teePoint);
                const selected = selection?.layer === 'tee';
                return <circle cx={tee.x} cy={tee.y} r={8} fill={layerPalette.tee} stroke={selected ? '#111827' : '#fff'} strokeWidth={selected ? 4 : 2} onClick={(event) => { event.stopPropagation(); setSelection({ layer: 'tee', index: 0 }); }} />;
              })() : null}
              {selection && selection.layer !== 'tee' ? renderHandles() : null}
              {stroke.length >= 2 ? (
                <polyline points={stroke.map((point) => { const pos = toCanvas(point); return `${pos.x},${pos.y}`; }).join(' ')} fill="none" stroke={activeTool === 'pan' ? '#111827' : layerPalette[activeTool]} strokeWidth={3} />
              ) : null}
            </svg>
          </div>

          <div className="hole-list">
            <button className="chip" onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              map.zoomTo(Math.max(MIN_EDITOR_ZOOM, map.getZoom() - 1));
            }}>- Zoom</button>
            <button className="chip" onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              map.zoomTo(Math.min(MAX_EDITOR_ZOOM, map.getZoom() + 1));
            }}>+ Zoom</button>
            <button className="chip" onClick={() => setConfirmResetAll(true)}>Reset view</button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Rensa aktivt lager"
        message="Detta går att ångra med Undo. Vill du fortsätta?"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          if (activeTool === 'pan') return;
          snapshotUndo();
          const next = { ...hole.layout };
          if (activeTool === 'tee') next.teePoint = null;
          if (activeTool === 'green') next.greenPolygon = [];
          if (activeTool === 'fairway') next.fairwayPolygon = [];
          if (activeTool === 'bunker') next.bunkerPolygons = [];
          if (activeTool === 'trees') next.treesPolygons = [];
          if (activeTool === 'ob') next.obPolygons = [];
          persistHole(next);
          push('Lager rensat', 'info');
        }}
      />

      <ConfirmDialog
        open={confirmResetAll}
        title="Reset view"
        message="Är du säker? Detta tar bort all ritad data för hålet (tee, green, fairway, bunker, träd och OB)."
        onCancel={() => setConfirmResetAll(false)}
        onConfirm={() => {
          setConfirmResetAll(false);
          snapshotUndo();
          const map = mapRef.current;
          const nextCenter = userPosition ?? DEFAULT_CENTER;
          persistHole({
            teePoint: null,
            greenPolygon: [],
            fairwayPolygon: [],
            bunkerPolygons: [],
            treesPolygons: [],
            obPolygons: []
          });
          setSelection(null);
          setStroke([]);
          setIsDrawing(false);
          setManualCenter(null);
          setZoom(17);
          map?.flyTo({ center: [nextCenter.lng, nextCenter.lat], zoom: 17, essential: true });
          push('Hålet har återställts', 'info');
        }}
      />
    </>
  );
}
