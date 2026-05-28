'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAutosave } from '../hooks/useAutosave';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { computeHoleLength } from '../lib/holeMetrics';
import { courseRepo } from '../lib/storage';
import { Course, GeoPoint, HoleLayoutGeometry } from '../lib/types';
import { HoleStrip } from './editor/HoleStrip';
import { Inspector } from './editor/Inspector';
import { MapControls } from './editor/MapControls';
import { ToolRail } from './editor/ToolRail';
import { Layer, LAYER_BY_KEY, LayerGlyph, Tool } from './editor/layers';
import { ConfirmDialog } from './common/ConfirmDialog';
import { SaveStatusBadge } from './common/SaveStatusBadge';
import { useToast } from './common/ToastProvider';

type Props = { initialCourse: Course };
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
const MAX_FAIRWAY_POLYGONS = 3;

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
  if (layer === 'fairway') {
    if (!polygon.length) return layout;
    const fairwayPolygons = layout.fairwayPolygons ?? (layout.fairwayPolygon.length ? [layout.fairwayPolygon] : []);
    const nextFairways = fairwayPolygons.slice(0, MAX_FAIRWAY_POLYGONS);
    if (nextFairways.length >= MAX_FAIRWAY_POLYGONS) return layout;
    const merged = [...nextFairways, polygon];
    return { ...layout, fairwayPolygons: merged, fairwayPolygon: merged[0] ?? [] };
  }
  if (layer === 'bunker') return polygon.length ? { ...layout, bunkerPolygons: [...layout.bunkerPolygons, polygon] } : layout;
  if (layer === 'trees') return polygon.length ? { ...layout, treesPolygons: [...layout.treesPolygons, polygon] } : layout;
  return polygon.length ? { ...layout, obPolygons: [...layout.obPolygons, polygon] } : layout;
};

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
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [confirmClearLayer, setConfirmClearLayer] = useState<Layer | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragVertex, setDragVertex] = useState<Selection>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [visibility, setVisibility] = useState<Record<Layer, boolean>>({ tee: true, green: true, fairway: true, bunker: true, trees: true, ob: true });
  const [locks, setLocks] = useState<Record<Layer, boolean>>({ tee: false, green: false, fairway: false, bunker: false, trees: false, ob: false });
  const [coordPopupOpen, setCoordPopupOpen] = useState(false);
  const [coordInput, setCoordInput] = useState('');
  const boardRef = useRef<HTMLDivElement | null>(null);
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    const seen = window.localStorage.getItem(TOOLTIP_KEY);
    setShowGuide(!seen);
  }, []);

  const hole = useMemo(() => course.holes.find((candidate) => candidate.holeNumber === selectedHole)!, [course.holes, selectedHole]);
  const fairwayPolygons = useMemo(
    () => hole.layout.fairwayPolygons ?? (hole.layout.fairwayPolygon.length ? [hole.layout.fairwayPolygon] : []),
    [hole.layout.fairwayPolygon, hole.layout.fairwayPolygons]
  );
  const center = manualCenter ?? userPosition ?? DEFAULT_CENTER;

  const counts: Record<Layer, number> = {
    tee: hole.layout.teePoint ? 1 : 0,
    green: hole.layout.greenPolygon.length >= 3 ? 1 : 0,
    fairway: fairwayPolygons.filter((polygon) => polygon.length >= 3).length,
    bunker: hole.layout.bunkerPolygons.length,
    trees: hole.layout.treesPolygons.length,
    ob: hole.layout.obPolygons.length
  };

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

      // Keep React state in sync when the user pans/zooms the map natively
      map.on('moveend', () => {
        const movedCenter = map.getCenter();
        setManualCenter({ lat: movedCenter.lat, lng: movedCenter.lng });
        setZoom(map.getZoom());
      });

      // Disable MapLibre's own scroll zoom — we handle it in onWheel to
      // avoid double-zoom and to keep the SVG overlay working.
      map.on('load', () => {
        map.scrollZoom.disable();
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

  // Wheel zoom — attached via native event listener so it works even when
  // the draw-board has pointerEvents:none in pan mode.
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const handler = (event: WheelEvent) => {
      const map = mapRef.current;
      if (!map) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const around = map.unproject([x, y]);
      const currentZoom = map.getZoom();
      const step = currentZoom < 8 ? 1.0 : currentZoom < 14 ? 0.6 : 0.35;
      const delta = event.deltaY > 0 ? -step : step;
      const nextZoom = Math.max(MIN_EDITOR_ZOOM, Math.min(MAX_EDITOR_ZOOM, currentZoom + delta));
      map.zoomTo(nextZoom, { around, duration: 0 });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [mapReady]);

  // Fly to tee when switching holes (NOT when user pans/zooms — that caused loops)
  const prevSelectedHole = useRef(selectedHole);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Only fly on initial load or when the user selects a different hole
    if (prevSelectedHole.current === selectedHole && mapReady) return;
    prevSelectedHole.current = selectedHole;
    const teePoint = hole.layout.teePoint;
    if (teePoint) {
      map.flyTo({ center: [teePoint.lng, teePoint.lat], zoom: Math.max(map.getZoom(), 16), essential: true });
    }
  }, [selectedHole, mapReady, hole.layout.teePoint]);

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

  const undo = () => {
    const prev = undoStack[undoStack.length - 1];
    if (!prev) return;
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, hole.layout]);
    persistHole(prev);
  };

  const redo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, hole.layout]);
    persistHole(next);
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
      const nextFairways = fairwayPolygons.map((polygon, index) => index === selection.index ? nextPolygon : polygon).slice(0, MAX_FAIRWAY_POLYGONS);
      next.fairwayPolygons = nextFairways;
      next.fairwayPolygon = nextFairways[0] ?? [];
    }
    if (selection.layer === 'bunker') next.bunkerPolygons = next.bunkerPolygons.map((polygon, index) => index === selection.index ? nextPolygon : polygon);
    if (selection.layer === 'trees') next.treesPolygons = next.treesPolygons.map((polygon, index) => index === selection.index ? nextPolygon : polygon);
    if (selection.layer === 'ob') next.obPolygons = next.obPolygons.map((polygon, index) => index === selection.index ? nextPolygon : polygon);
    persistHole(next);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragVertex) return;
    if (activeTool !== 'pan' && locks[activeTool]) {
      push(`${LAYER_BY_KEY[activeTool].label} är låst`, 'error');
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
    if (activeTool === 'fairway' && next === hole.layout) {
      push(`Max ${MAX_FAIRWAY_POLYGONS} fairways per hål`, 'error');
      setStroke([]);
      setIsDrawing(false);
      return;
    }
    persistHole(next);
    setStroke([]);
    setIsDrawing(false);
  };

  const insertPoint = () => {
    const polygon = readSelectedPolygon();
    if (!polygon || polygon.length < 2) return;
    if (!selection?.pointIndex || selection.pointIndex <= 0) {
      push('Markera en punkt (ej den första) för att infoga en ny intill.', 'error');
      return;
    }
    snapshotUndo();
    const index = selection.pointIndex;
    const a = polygon[index - 1];
    const b = polygon[index];
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    writeSelectedPolygon([...polygon.slice(0, index), mid, ...polygon.slice(index)]);
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
    push('Valt objekt borttaget', 'info');
  };

  const simplifySelected = () => {
    if (!selection || selection.layer === 'tee') {
      push('Markera en polygon först.', 'error');
      return;
    }
    const polygon = readSelectedPolygon();
    if (!polygon || polygon.length < 8) {
      push('Behöver minst 8 punkter för förenkling.', 'error');
      return;
    }
    snapshotUndo();
    const closed = polygon[0].lat === polygon[polygon.length - 1].lat && polygon[0].lng === polygon[polygon.length - 1].lng;
    const body = closed ? polygon.slice(0, -1) : polygon.slice();
    const simplifiedBody = body.filter((_, index) => index % 2 === 0);
    const candidate = simplifiedBody.length >= 3 ? simplifiedBody : body;
    const next = closed ? [...candidate, candidate[0]] : candidate;
    writeSelectedPolygon(next);
    push('Polygon förenklad', 'success');
  };

  const clearLayer = (layer: Layer) => {
    snapshotUndo();
    const next = { ...hole.layout };
    if (layer === 'tee') next.teePoint = null;
    if (layer === 'green') next.greenPolygon = [];
    if (layer === 'fairway') { next.fairwayPolygons = []; next.fairwayPolygon = []; }
    if (layer === 'bunker') next.bunkerPolygons = [];
    if (layer === 'trees') next.treesPolygons = [];
    if (layer === 'ob') next.obPolygons = [];
    if (selection?.layer === layer) setSelection(null);
    persistHole(next);
    push(`${LAYER_BY_KEY[layer].label} rensat`, 'info');
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

  const jumpToCoord = () => {
    const parts = coordInput.split(/[,\s]+/).map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
    if (parts.length < 2) {
      push('Ange lat, lng — t.ex. 55.6050, 13.0038', 'error');
      return;
    }
    const [lat, lng] = parts;
    const map = mapRef.current;
    if (map) {
      map.flyTo({ center: [lng, lat], zoom: 17, essential: true });
      setManualCenter({ lat, lng });
    }
    setCoordPopupOpen(false);
    setCoordInput('');
  };

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomTo(Math.max(MIN_EDITOR_ZOOM, Math.min(MAX_EDITOR_ZOOM, map.getZoom() + delta)));
  };

  const fitTee = () => {
    const map = mapRef.current;
    const tee = hole.layout.teePoint;
    if (!map || !tee) return;
    map.flyTo({ center: [tee.lng, tee.lat], zoom: Math.max(map.getZoom(), 16), essential: true });
  };

  const drawPolygon = (polygon: GeoPoint[], color: string, key: string, onClick: () => void, selected: boolean, fill?: string) => {
    if (polygon.length < 3) return null;
    const points = polygon.map((p) => { const pos = toCanvas(p); return `${pos.x},${pos.y}`; }).join(' ');
    return <polygon key={key} points={points} fill={fill ?? `${color}55`} stroke={selected ? '#f8fafc' : color} strokeWidth={selected ? 4 : 2.5} strokeDasharray={selected ? '6 4' : undefined} onClick={(event) => { event.stopPropagation(); onClick(); }} style={{ cursor: 'pointer' }} />;
  };

  const renderHandles = () => {
    const polygon = readSelectedPolygon();
    if (!polygon) return null;
    return polygon.map((point, pointIndex) => {
      const pos = toCanvas(point);
      const isActive = selection?.pointIndex === pointIndex;
      return (
        <circle
          key={`handle_${pointIndex}`}
          cx={pos.x}
          cy={pos.y}
          r={isActive ? 7 : 5}
          fill={isActive ? '#0f766e' : '#fff'}
          stroke="#0f172a"
          strokeWidth={2}
          style={{ cursor: 'grab' }}
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

  const dismissGuide = () => {
    setShowGuide(false);
    window.localStorage.setItem(TOOLTIP_KEY, '1');
  };

  const isDrawingTool = activeTool !== 'pan';
  const activeDef = isDrawingTool ? LAYER_BY_KEY[activeTool] : null;
  const isEmptyHole = !hole.layout.teePoint && !hole.layout.greenPolygon.length;
  const selectedPointCount = selection && selection.layer !== 'tee' ? (readSelectedPolygon()?.length ?? 0) : 0;

  return (
    <div className="editor">
      <div className="editor-topbar">
        <div className="editor-topbar-left">
          <span className="editor-course-name">{course.courseName}</span>
          <HoleStrip holes={course.holes} selectedHole={selectedHole} onSelect={setSelectedHole} />
        </div>

        <div className="editor-topbar-right">
          <button className="chip" disabled={undoStack.length === 0} onClick={undo} title="Ångra (Ctrl/Cmd+Z)">↶ Ångra</button>
          <button className="chip" disabled={redoStack.length === 0} onClick={redo} title="Gör om">↷ Gör om</button>
          <button className={`chip ${showShortcuts ? 'active-chip' : ''}`} onClick={() => setShowShortcuts((prev) => !prev)} title="Tangentbordsgenvägar">?</button>
          <SaveStatusBadge state={saveState} lastSavedAt={lastSavedAt} />
          <button
            className="primary-btn"
            onClick={async () => {
              const ok = await saveNow();
              push(ok ? 'Banan sparad' : 'Kunde inte spara banan', ok ? 'success' : 'error');
            }}
          >
            Spara nu
          </button>
        </div>
      </div>

      {showShortcuts ? (
        <div className="shortcut-bar">
          <strong>Genvägar:</strong>
          <span><kbd>V</kbd> Panorera</span>
          <span><kbd>T</kbd> Tee</span>
          <span><kbd>G</kbd> Green</span>
          <span><kbd>F</kbd> Fairway</span>
          <span><kbd>Enter</kbd> Slutför</span>
          <span><kbd>Esc</kbd> Avbryt</span>
          <span><kbd>Delete</kbd> Ta bort</span>
          <span><kbd>Ctrl/Cmd+Z</kbd> Ångra</span>
        </div>
      ) : null}

      <div className="editor-stage">
        <ToolRail
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          counts={counts}
          visibility={visibility}
          locks={locks}
          onToggleVisibility={(layer) => setVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }))}
          onToggleLock={(layer) => setLocks((prev) => ({ ...prev, [layer]: !prev[layer] }))}
          onClearLayer={(layer) => setConfirmClearLayer(layer)}
        />

        <div
          ref={boardRef}
          className="map-stage"
          onPointerDown={isDrawingTool ? onPointerDown : undefined}
          onPointerMove={isDrawingTool ? onPointerMove : undefined}
          onPointerUp={isDrawingTool ? completeStroke : undefined}
          onPointerLeave={isDrawingTool ? completeStroke : undefined}
          onDoubleClick={isDrawingTool ? completeStroke : undefined}
          tabIndex={0}
          onClick={isDrawingTool ? () => setSelection(null) : undefined}
          style={{ cursor: activeTool === 'pan' ? 'grab' : 'crosshair' }}
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
              undo();
            }
          }}
        >
          <div ref={mapCanvasRef} className="map-canvas" />
          <svg style={{
            pointerEvents: activeTool === 'pan' ? 'none' : 'auto',
            zIndex: activeTool === 'pan' ? 0 : 2,
          }}>
            <defs>
              <pattern id="pattern_fairway" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="8" height="8" fill="#16a34a55" />
                <line x1="0" y1="0" x2="0" y2="8" stroke="#14532d" strokeWidth="1" />
              </pattern>
              <pattern id="pattern_trees" width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="#15803d55" />
                <circle cx="2" cy="2" r="1" fill="#14532d" />
                <circle cx="6" cy="6" r="1" fill="#14532d" />
              </pattern>
              <pattern id="pattern_ob" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="8" height="8" fill="#dc262644" />
                <line x1="0" y1="0" x2="0" y2="8" stroke="#7f1d1d" strokeWidth="1.5" />
              </pattern>
            </defs>
            {visibility.green ? drawPolygon(hole.layout.greenPolygon, LAYER_BY_KEY.green.color, 'green', () => setSelection({ layer: 'green', index: 0 }), selection?.layer === 'green') : null}
            {visibility.fairway ? fairwayPolygons.map((polygon, index) => drawPolygon(polygon, LAYER_BY_KEY.fairway.color, `fairway_${index}`, () => setSelection({ layer: 'fairway', index }), selection?.layer === 'fairway' && selection.index === index, 'url(#pattern_fairway)')) : null}
            {visibility.bunker ? hole.layout.bunkerPolygons.map((polygon, index) => drawPolygon(polygon, LAYER_BY_KEY.bunker.color, `bunker_${index}`, () => setSelection({ layer: 'bunker', index }), selection?.layer === 'bunker' && selection.index === index)) : null}
            {visibility.trees ? hole.layout.treesPolygons.map((polygon, index) => drawPolygon(polygon, LAYER_BY_KEY.trees.color, `trees_${index}`, () => setSelection({ layer: 'trees', index }), selection?.layer === 'trees' && selection.index === index, 'url(#pattern_trees)')) : null}
            {visibility.ob ? hole.layout.obPolygons.map((polygon, index) => drawPolygon(polygon, LAYER_BY_KEY.ob.color, `ob_${index}`, () => setSelection({ layer: 'ob', index }), selection?.layer === 'ob' && selection.index === index, 'url(#pattern_ob)')) : null}
            {visibility.tee && hole.layout.teePoint ? (() => {
              const tee = toCanvas(hole.layout.teePoint);
              const selected = selection?.layer === 'tee';
              return <circle cx={tee.x} cy={tee.y} r={9} fill={LAYER_BY_KEY.tee.color} stroke={selected ? '#f8fafc' : '#fff'} strokeWidth={selected ? 4 : 2.5} style={{ cursor: 'pointer' }} onClick={(event) => { event.stopPropagation(); setSelection({ layer: 'tee', index: 0 }); }} />;
            })() : null}
            {selection && selection.layer !== 'tee' ? renderHandles() : null}
            {stroke.length >= 2 ? (
              <polyline points={stroke.map((point) => { const pos = toCanvas(point); return `${pos.x},${pos.y}`; }).join(' ')} fill="none" stroke={activeTool === 'pan' ? '#111827' : LAYER_BY_KEY[activeTool].color} strokeWidth={3} strokeLinejoin="round" />
            ) : null}
          </svg>

          {activeDef ? (
            <div className="draw-hint" style={{ ['--layer' as string]: activeDef.color }}>
              <span className="draw-hint-swatch" style={{ background: activeDef.color }}><LayerGlyph layer={activeDef.key} size={13} /></span>
              <span>Ritar <strong>{activeDef.label}</strong> · {activeDef.hint} · <kbd>Esc</kbd> avbryt</span>
            </div>
          ) : null}

          {showGuide ? (
            <div className="map-guide">
              <h3>Kom igång på 3 steg</h3>
              <ol>
                <li>Placera <strong>tee</strong> med tee-verktyget i raden till vänster.</li>
                <li>Rita <strong>green</strong> och <strong>fairway</strong> — dra för att rita, dubbelklicka för att slutför.</li>
                <li>Fyll i <strong>hålinfo</strong> till höger. Allt sparas automatiskt.</li>
              </ol>
              <button className="primary-btn" onClick={dismissGuide}>Sätt igång</button>
            </div>
          ) : null}

          {isEmptyHole && !showGuide && activeTool === 'pan' ? (
            <div className="map-empty-cta">
              <p>Hål {selectedHole} är tomt</p>
              <button className="primary-btn" onClick={() => setActiveTool('tee')}>Placera tee</button>
            </div>
          ) : null}

          <MapControls
            onZoomIn={() => zoomBy(1)}
            onZoomOut={() => zoomBy(-1)}
            onFitTee={fitTee}
            canFitTee={Boolean(hole.layout.teePoint)}
            onOpenCoord={() => setCoordPopupOpen(true)}
          />

          {coordPopupOpen ? (
            <div className="coord-popup">
              <div className="coord-popup-head">
                <strong>Hoppa till koordinat</strong>
                <button className="coord-popup-close" onClick={() => setCoordPopupOpen(false)} aria-label="Stäng">✕</button>
              </div>
              <input
                type="text"
                placeholder="lat, lng — t.ex. 55.6050, 13.0038"
                value={coordInput}
                onChange={(event) => setCoordInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') jumpToCoord(); }}
                autoFocus
              />
              <button className="primary-btn" onClick={jumpToCoord}>Gå dit</button>
            </div>
          ) : null}
        </div>

        <Inspector
          hole={hole}
          teeToGreenMeters={teeToGreenMeters}
          onMeta={setMeta}
          selection={selection}
          selectedPointCount={selectedPointCount}
          onSimplify={simplifySelected}
          onInsertPoint={insertPoint}
          onDeletePoint={deletePoint}
          onDeleteSelected={deleteSelected}
          onResetHole={() => setConfirmResetAll(true)}
        />
      </div>

      <ConfirmDialog
        open={confirmClearLayer !== null}
        title={`Rensa ${confirmClearLayer ? LAYER_BY_KEY[confirmClearLayer].label.toLowerCase() : ''}`}
        message="Detta tar bort alla figurer i lagret för det här hålet. Går att ångra."
        onCancel={() => setConfirmClearLayer(null)}
        onConfirm={() => {
          if (confirmClearLayer) clearLayer(confirmClearLayer);
          setConfirmClearLayer(null);
        }}
      />

      <ConfirmDialog
        open={confirmResetAll}
        title="Rensa hela hålet"
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
            fairwayPolygons: [],
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
    </div>
  );
}
