'use client';

import { centroid, lineString, length } from '@turf/turf';
import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAutosave } from '../hooks/useAutosave';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
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

export function HoleManager({ initialCourse }: Props) {
  const { push } = useToast();
  const [course, setCourse] = useState<Course>(initialCourse);
  const [selectedHole, setSelectedHole] = useState(1);
  const [activeTool, setActiveTool] = useState<Tool>('pan');
  const [stroke, setStroke] = useState<GeoPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(17);
  const [panStart, setPanStart] = useState<{ x: number; y: number; center: GeoPoint } | null>(null);
  const [manualCenter, setManualCenter] = useState<GeoPoint | null>(null);
  const [undoStack, setUndoStack] = useState<HoleLayoutGeometry[]>([]);
  const [redoStack, setRedoStack] = useState<HoleLayoutGeometry[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragVertex, setDragVertex] = useState<Selection>(null);
  const [showTooltips, setShowTooltips] = useState(false);
  const [visibility, setVisibility] = useState<Record<Layer, boolean>>({ tee: true, green: true, fairway: true, bunker: true, trees: true, ob: true });
  const [locks, setLocks] = useState<Record<Layer, boolean>>({ tee: false, green: false, fairway: false, bunker: false, trees: false, ob: false });
  const boardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const seen = window.localStorage.getItem(TOOLTIP_KEY);
    setShowTooltips(!seen);
  }, []);

  const hole = useMemo(() => course.holes.find((candidate) => candidate.holeNumber === selectedHole)!, [course.holes, selectedHole]);
  const center = manualCenter ?? hole.layout.teePoint ?? DEFAULT_CENTER;
  const degreeSpan = 0.007 / Math.max(1, zoom / 10);

  const saveCourse = async (nextCourse: Course) => {
    courseRepo.saveAll(courseRepo.list().map((item) => (item.id === nextCourse.id ? nextCourse : item)));
  };

  const { saveState, lastSavedAt } = useAutosave({ value: course, onSave: saveCourse, delay: 700 });
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
    if (!rect) return null;
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    return { lng: center.lng + (x / rect.width - 0.5) * degreeSpan, lat: center.lat - (y / rect.height - 0.5) * degreeSpan };
  };

  const toCanvas = (point: GeoPoint) => {
    const rect = boardRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 1;
    const height = rect?.height ?? 1;
    return { x: ((point.lng - center.lng) / degreeSpan + 0.5) * width, y: ((center.lat - point.lat) / degreeSpan + 0.5) * height };
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

    if (activeTool === 'pan') {
      setPanStart({ x: event.clientX, y: event.clientY, center });
      return;
    }
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

    if (activeTool === 'pan') {
      if (!panStart) return;
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = event.clientX - panStart.x;
      const dy = event.clientY - panStart.y;
      setManualCenter({ lat: panStart.center.lat - (dy / rect.height) * degreeSpan, lng: panStart.center.lng - (dx / rect.width) * degreeSpan });
      return;
    }

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

  const teeToGreenMeters = useMemo(() => {
    if (!hole.layout.teePoint || hole.layout.greenPolygon.length < 3) return null;
    const greenCenter = centroid({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [hole.layout.greenPolygon.map((p) => [p.lng, p.lat])] }, properties: {} });
    const track = lineString([[hole.layout.teePoint.lng, hole.layout.teePoint.lat], [greenCenter.geometry.coordinates[0], greenCenter.geometry.coordinates[1]]]);
    return Math.round(length(track, { units: 'meters' }));
  }, [hole.layout.greenPolygon, hole.layout.teePoint]);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const staticMapUrl = mapboxToken
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${center.lng},${center.lat},${zoom}/1600x900?access_token=${mapboxToken}`
    : `https://staticmap.openstreetmap.de/staticmap.php?center=${center.lat},${center.lng}&zoom=${zoom}&size=1600x900&maptype=mapnik`;

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
            <p className="small-note">Kartkälla: {mapboxToken ? 'Mapbox Static' : 'OpenStreetMap fallback'}.</p>
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
            onResetView={() => {
              setManualCenter(null);
              setZoom(17);
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
            style={{ backgroundImage: `url(${staticMapUrl})` }}
            tabIndex={0}
            onClick={() => setSelection(null)}
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
            <svg>
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
            <button className="chip" onClick={() => setZoom((z) => Math.max(13, z - 1))}>- Zoom</button>
            <button className="chip" onClick={() => setZoom((z) => Math.min(20, z + 1))}>+ Zoom</button>
            <button className="chip" disabled={!selection || selection.layer === 'tee'} onClick={insertPoint}>Insert point</button>
            <button className="chip" disabled={!selection || selection.pointIndex === undefined} onClick={deletePoint}>Delete point</button>
            <button className="chip" disabled={!selection} onClick={deleteSelected}>Delete selected</button>
            <button className="chip" onClick={() => setConfirmClear(true)}>Rensa aktivt lager</button>
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
    </>
  );
}
