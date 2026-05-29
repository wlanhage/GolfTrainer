'use client';

import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SaveState } from '../../hooks/useAutosave';
import { Course, GeoPoint, HoleLayoutGeometry } from '../../lib/types';
import { HoleEditorInspector } from './HoleEditorInspector';
import './hole-editor.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Layer = 'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob';
type Tool = 'select' | Layer;
type Selection = { layer: Layer; index: number; pointIndex?: number } | null;

type MapCenter = { lng: number; lat: number };
type MapPoint = { x: number; y: number };

// MapLibre type used only for .zoomTo / .flyTo in the shell
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

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_EDITOR_ZOOM = 2;
const MAX_EDITOR_ZOOM = 20;
const TOOLTIP_KEY = 'gt_admin_editor_seen_tooltips_v1';

const LAYER_PALETTE: Record<Layer, string> = {
  tee: '#ef4444',
  green: '#22c55e',
  fairway: '#16a34a',
  bunker: '#f59e0b',
  trees: '#15803d',
  ob: '#dc2626',
};

// (No helpers needed in shell — all drawing logic lives in HoleManager.tsx)

// ─── Toast (local, dark-themed) ───────────────────────────────────────────────

type ToastEntry = { id: number; message: string; type: 'success' | 'error' | 'info' };

function useLocalToast() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const push = useCallback(
    (message: string, type: ToastEntry['type'] = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
      window.setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        2500
      );
    },
    []
  );
  return { toasts, push };
}

// ─── Main Props ───────────────────────────────────────────────────────────────

export type HoleEditorShellProps = {
  course: Course;
  selectedHole: number;
  activeTool: Tool;
  stroke: GeoPoint[];
  isDrawing: boolean;
  undoStack: HoleLayoutGeometry[];
  redoStack: HoleLayoutGeometry[];
  selection: Selection;
  dragVertex: Selection;
  visibility: Record<Layer, boolean>;
  locks: Record<Layer, boolean>;
  saveState: SaveState;
  lastSavedAt: Date | null;
  teeToGreenMeters: number | null;
  mapReady: boolean;
  mapCanvasRef: React.RefObject<HTMLDivElement | null>;
  mapRef: React.RefObject<MapLibreMap | null>;

  onSelectHole: (n: number) => void;
  onSelectTool: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onCanvasClick: () => void;
  onSetMeta: (field: 'par' | 'length' | 'hcpIndex', value: string) => void;
  onToggleVisibility: (layer: Layer) => void;
  onToggleLock: (layer: Layer) => void;
  onInsertPoint: () => void;
  onSimplify: () => void;
  onDuplicate: () => void;
  onDeleteSelected: () => void;
  onClearLayer: () => void;
  onResetAll: () => void;
  onSaveNow: () => Promise<void>;
  readSelectedPolygon: () => GeoPoint[] | null;
  toCanvas: (pt: GeoPoint) => { x: number; y: number };
  setSelection: (s: Selection) => void;
  setDragVertex: (s: Selection) => void;
  fairwayPolygons: GeoPoint[][];
};

// ─── Component ────────────────────────────────────────────────────────────────

export function HoleEditorShell(props: HoleEditorShellProps) {
  const {
    course,
    selectedHole,
    activeTool,
    stroke,
    isDrawing,
    undoStack,
    redoStack,
    selection,
    visibility,
    locks,
    saveState,
    lastSavedAt,
    teeToGreenMeters,
    mapCanvasRef,
    mapRef,
    onSelectHole,
    onSelectTool,
    onUndo,
    onRedo,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onCanvasClick,
    onSetMeta,
    onToggleVisibility,
    onToggleLock,
    onInsertPoint,
    onSimplify,
    onDuplicate,
    onDeleteSelected,
    onClearLayer,
    onResetAll,
    onSaveNow,
    readSelectedPolygon,
    toCanvas,
    setSelection,
    setDragVertex,
    fairwayPolygons,
  } = props;

  const { toasts, push: pushToast } = useLocalToast();

  // Lock body scroll while editor is mounted
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const hole = useMemo(
    () => course.holes.find((h) => h.holeNumber === selectedHole)!,
    [course.holes, selectedHole]
  );

  // ── Space-hold pan state ──────────────────────────────────────────────────
  const [isPanning, setIsPanning] = useState(false);
  const spaceDownRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Never intercept shortcuts when focus is in a text field
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space' && !spaceDownRef.current && !e.repeat) {
        e.preventDefault();
        spaceDownRef.current = true;
        setIsPanning(true);
        // Cancel any in-progress stroke
        if (isDrawing) {
          onPointerLeave();
        }
        return; // space is handled — don't fall through to other shortcuts
      }
      if (e.key.toLowerCase() === 'v') onSelectTool('select');
      if (e.key.toLowerCase() === 't') onSelectTool('tee');
      if (e.key.toLowerCase() === 'g') onSelectTool('green');
      if (e.key.toLowerCase() === 'f') onSelectTool('fairway');
      if (e.key.toLowerCase() === 'b') onSelectTool('bunker');
      if (e.key.toLowerCase() === 'r') onSelectTool('trees');
      if (e.key.toLowerCase() === 'o') onSelectTool('ob');
      if (e.key.toLowerCase() === 'j') setCoordOpen(true);
      if (e.key === 'Escape') {
        onPointerLeave();
        setSelection(null);
        setShowShortcuts(false);
        setCoordOpen(false);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        onDeleteSelected();
      }
      if (e.key === 'Enter') onPointerUp();
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onUndo();
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.shiftKey ? e.key.toLowerCase() === 'z' : e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        onRedo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSaveNow().then(() => pushToast('Banan sparad', 'success')).catch(() => pushToast('Kunde inte spara', 'error'));
      }
      if (e.key === '?') setShowShortcuts((p) => !p);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spaceDownRef.current) {
        spaceDownRef.current = false;
        setIsPanning(false);
      }
    };

    const onBlur = () => {
      if (spaceDownRef.current) {
        spaceDownRef.current = false;
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    isDrawing,
    onDeleteSelected,
    onPointerLeave,
    onPointerUp,
    onRedo,
    onSaveNow,
    onSelectTool,
    onUndo,
    pushToast,
    setSelection,
  ]);

  // Middle-mouse pan: enable MapLibre dragPan while middle button is held
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        if (isDrawing) onPointerLeave();
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) setIsPanning(false);
    };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDrawing, mapRef, onPointerLeave]);

  // ── Coord jump ────────────────────────────────────────────────────────────
  const [coordOpen, setCoordOpen] = useState(false);
  const [coordInput, setCoordInput] = useState('');

  const handleCoordJump = () => {
    const parts = coordInput
      .split(/[,\s]+/)
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));
    if (parts.length >= 2) {
      const [lat, lng] = parts;
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 18, essential: true });
      setCoordOpen(false);
      setCoordInput('');
    } else {
      pushToast('Ange lat, lng — t.ex. 57.7089, 11.9746', 'error');
    }
  };

  // ── Shortcuts panel ───────────────────────────────────────────────────────
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── Confirm dialogs ───────────────────────────────────────────────────────
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // ── Show tutorial tip once ────────────────────────────────────────────────
  const [showTip, setShowTip] = useState(false);
  useEffect(() => {
    const seen = window.localStorage.getItem(TOOLTIP_KEY);
    if (!seen) setShowTip(true);
  }, []);

  const dismissTip = () => {
    setShowTip(false);
    window.localStorage.setItem(TOOLTIP_KEY, '1');
  };

  // ── Rendering helpers ─────────────────────────────────────────────────────
  const drawPolygon = (
    polygon: GeoPoint[],
    color: string,
    key: string,
    onClick: () => void,
    selected: boolean,
    fill?: string
  ) => {
    if (polygon.length < 3) return null;
    const points = polygon
      .map((p) => {
        const pos = toCanvas(p);
        return `${pos.x},${pos.y}`;
      })
      .join(' ');
    return (
      <polygon
        key={key}
        points={points}
        fill={fill ?? `${color}66`}
        stroke={selected ? '#ffffff' : color}
        strokeWidth={selected ? 3 : 2}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{ cursor: 'pointer' }}
      />
    );
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
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!selection) return;
            setSelection({ ...selection, pointIndex });
            setDragVertex({ ...selection, pointIndex });
          }}
        />
      );
    });
  };

  // Hole completion status for strip chips
  const holeStatus = (h: Course['holes'][number]) => {
    const fp =
      h.layout.fairwayPolygons ??
      (h.layout.fairwayPolygon.length ? [h.layout.fairwayPolygon] : []);
    const complete =
      Boolean(h.layout.teePoint) &&
      h.layout.greenPolygon.length >= 3 &&
      fp.some((p) => p.length >= 3);
    const partial =
      Boolean(h.layout.teePoint) ||
      h.layout.greenPolygon.length >= 3 ||
      fp.some((p) => p.length >= 3);
    if (complete) return 'done';
    if (partial) return 'partial';
    return '';
  };

  // Save status label
  const saveLabel = (() => {
    if (saveState === 'saving') return 'Sparar…';
    if (saveState === 'unsaved') return 'Osparade ändringar';
    if (saveState === 'error') return 'Sparningsfel';
    if (lastSavedAt) {
      const hhmm = lastSavedAt.toLocaleTimeString('sv-SE', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `Sparad · ${hhmm}`;
    }
    return 'Sparad · auto';
  })();

  const svgCursor = isPanning ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair';

  // Context bar: show when there's a selection and we're not panning
  const showCtxBar = Boolean(selection) && !isPanning;
  const selectedLayerColor = selection
    ? LAYER_PALETTE[selection.layer]
    : '#22c55e';
  const selectedLayerLabel = selection
    ? {
        tee: 'Tee',
        green: 'Green',
        fairway: 'Fairway',
        bunker: 'Bunker',
        trees: 'Träd',
        ob: 'OB',
      }[selection.layer]
    : '';
  const selectedPoints = readSelectedPolygon()?.length ?? 0;

  return (
    <div className="he-root">
      {/* MAP */}
      <div ref={mapCanvasRef} className="he-map-container" />

      {/* SVG DRAW OVERLAY */}
      <svg
        className={`he-svg-overlay${isPanning ? ' panning' : ''}`}
        style={{ cursor: svgCursor, touchAction: 'none' }}
        onPointerDown={isPanning ? undefined : onPointerDown}
        onPointerMove={isPanning ? undefined : onPointerMove}
        onPointerUp={isPanning ? undefined : onPointerUp}
        onPointerLeave={isPanning ? undefined : onPointerLeave}
        onClick={isPanning ? undefined : onCanvasClick}
      >
        <defs>
          <pattern
            id="he_pattern_fairway"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill="#16a34a66" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#14532d" strokeWidth="1" />
          </pattern>
          <pattern
            id="he_pattern_trees"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <rect width="8" height="8" fill="#15803d66" />
            <circle cx="2" cy="2" r="1" fill="#14532d" />
            <circle cx="6" cy="6" r="1" fill="#14532d" />
          </pattern>
          <pattern
            id="he_pattern_ob"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill="#dc262644" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#7f1d1d" strokeWidth="1.5" />
          </pattern>
        </defs>

        {/* Layers */}
        {visibility.green
          ? drawPolygon(
              hole.layout.greenPolygon,
              LAYER_PALETTE.green,
              'green',
              () => setSelection({ layer: 'green', index: 0 }),
              selection?.layer === 'green'
            )
          : null}
        {visibility.fairway
          ? fairwayPolygons.map((polygon, index) =>
              drawPolygon(
                polygon,
                LAYER_PALETTE.fairway,
                `fairway_${index}`,
                () => setSelection({ layer: 'fairway', index }),
                selection?.layer === 'fairway' && selection.index === index,
                'url(#he_pattern_fairway)'
              )
            )
          : null}
        {visibility.bunker
          ? hole.layout.bunkerPolygons.map((polygon, index) =>
              drawPolygon(
                polygon,
                LAYER_PALETTE.bunker,
                `bunker_${index}`,
                () => setSelection({ layer: 'bunker', index }),
                selection?.layer === 'bunker' && selection.index === index
              )
            )
          : null}
        {visibility.trees
          ? hole.layout.treesPolygons.map((polygon, index) =>
              drawPolygon(
                polygon,
                LAYER_PALETTE.trees,
                `trees_${index}`,
                () => setSelection({ layer: 'trees', index }),
                selection?.layer === 'trees' && selection.index === index,
                'url(#he_pattern_trees)'
              )
            )
          : null}
        {visibility.ob
          ? hole.layout.obPolygons.map((polygon, index) =>
              drawPolygon(
                polygon,
                LAYER_PALETTE.ob,
                `ob_${index}`,
                () => setSelection({ layer: 'ob', index }),
                selection?.layer === 'ob' && selection.index === index,
                'url(#he_pattern_ob)'
              )
            )
          : null}

        {/* Tee marker */}
        {visibility.tee && hole.layout.teePoint
          ? (() => {
              const tee = toCanvas(hole.layout.teePoint);
              const selected = selection?.layer === 'tee';
              return (
                <circle
                  cx={tee.x}
                  cy={tee.y}
                  r={8}
                  fill={LAYER_PALETTE.tee}
                  stroke={selected ? '#ffffff' : '#fff'}
                  strokeWidth={selected ? 4 : 2}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelection({ layer: 'tee', index: 0 });
                  }}
                />
              );
            })()
          : null}

        {/* Vertex handles for selected polygon */}
        {selection && selection.layer !== 'tee' ? renderHandles() : null}

        {/* In-progress stroke */}
        {stroke.length >= 2 ? (
          <polyline
            points={stroke
              .map((pt) => {
                const pos = toCanvas(pt);
                return `${pos.x},${pos.y}`;
              })
              .join(' ')}
            fill="none"
            stroke={
              activeTool !== 'select'
                ? LAYER_PALETTE[activeTool as Layer]
                : '#6b7280'
            }
            strokeWidth={3}
            strokeDasharray="6 3"
          />
        ) : null}
      </svg>

      {/* ── TOP BAR ── */}
      <div className="he-topbar">
        <div className="he-crumbs">
          <a href="/courses" className="back" title="Tillbaka till banor">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </a>
          <span>Banor</span>
          <span className="sep">/</span>
          <span className="course-name" title={`${course.clubName} · ${course.courseName}`}>
            {course.clubName} · {course.courseName}
          </span>
        </div>

        <div className="he-hole-jumper">
          <button
            title="Föregående hål (←)"
            disabled={selectedHole <= 1}
            onClick={() => onSelectHole(selectedHole - 1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="he-hole-pill">
            <span>Hål {selectedHole}</span>
            {hole.par !== null && (
              <span className="par-tag">PAR {hole.par}</span>
            )}
          </div>
          <button
            title="Nästa hål (→)"
            disabled={selectedHole >= course.holeCount}
            onClick={() => onSelectHole(selectedHole + 1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="he-spacer" />

        <div
          className={`he-save-status${saveState === 'unsaved' || saveState === 'saving' ? ' unsaved' : saveState === 'error' ? ' error' : ''}`}
          title={lastSavedAt ? `Senast sparad ${lastSavedAt.toLocaleTimeString('sv-SE')}` : undefined}
        >
          <span className="dot" />
          {saveLabel}
        </div>

        <button
          className="he-icon-btn"
          title="Ångra (⌘Z)"
          disabled={undoStack.length === 0}
          onClick={onUndo}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" />
            <path d="M3 13a9 9 0 1 0 3-7" />
          </svg>
        </button>
        <button
          className="he-icon-btn"
          title="Gör om (⌘⇧Z)"
          disabled={redoStack.length === 0}
          onClick={onRedo}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6" />
            <path d="M21 13a9 9 0 1 1-3-7" />
          </svg>
        </button>
        <button
          className="he-icon-btn"
          title="Kortkommandon (?)"
          onClick={() => setShowShortcuts((p) => !p)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2.5-3 4.5" />
            <circle cx="12" cy="18" r="0.6" fill="currentColor" />
          </svg>
        </button>
        <button
          className="he-btn-primary"
          title="Spara nu (⌘S)"
          onClick={() =>
            onSaveNow()
              .then(() => pushToast('Banan sparad', 'success'))
              .catch(() => pushToast('Kunde inte spara', 'error'))
          }
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <path d="M17 21v-8H7v8M7 3v5h8" />
          </svg>
          Spara
        </button>
      </div>

      {/* ── TOOL DOCK ── */}
      <div className="he-tool-dock" role="toolbar" aria-label="Ritverktyg">
        <ToolBtn
          tool="select"
          active={activeTool === 'select'}
          kbd="V"
          tooltip="Markera / Redigera (V)"
          onClick={() => onSelectTool('select')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l7 18 2-8 8-2-17-8z" />
          </svg>
        </ToolBtn>

        <div className="he-tool-sep" />

        <ToolBtn tool="tee" active={activeTool === 'tee'} kbd="T" tooltip="Placera Tee (T)" swatch="#ef4444" onClick={() => onSelectTool('tee')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="10" r="3" /><path d="M12 13v8M9 21h6" />
          </svg>
        </ToolBtn>
        <ToolBtn tool="green" active={activeTool === 'green'} kbd="G" tooltip="Rita Green (G)" swatch="#22c55e" onClick={() => onSelectTool('green')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14c4-7 12-7 16 0" /><ellipse cx="12" cy="15" rx="8" ry="4" />
          </svg>
        </ToolBtn>
        <ToolBtn tool="fairway" active={activeTool === 'fairway'} kbd="F" tooltip="Rita Fairway (F)" swatch="#16a34a" onClick={() => onSelectTool('fairway')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21c5-2 5-10 9-12s5-6 9-6" /><path d="M5 21c4-2 4-9 8-11s4-5 8-5" opacity=".55" />
          </svg>
        </ToolBtn>
        <ToolBtn tool="bunker" active={activeTool === 'bunker'} kbd="B" tooltip="Rita Bunker (B)" swatch="#f59e0b" onClick={() => onSelectTool('bunker')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="14" rx="9" ry="5" /><path d="M5 10c2-2 4 0 6-1s4 1 7-1" />
          </svg>
        </ToolBtn>
        <ToolBtn tool="trees" active={activeTool === 'trees'} kbd="R" tooltip="Rita Träd (R)" swatch="#15803d" onClick={() => onSelectTool('trees')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l5 7h-3l4 6h-4l3 5H7l3-5H6l4-6H7l5-7z" />
          </svg>
        </ToolBtn>
        <ToolBtn tool="ob" active={activeTool === 'ob'} kbd="O" tooltip="Rita OB (O)" swatch="#dc2626" onClick={() => onSelectTool('ob')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l18 18M3 21L21 3" />
          </svg>
        </ToolBtn>

        <div className="he-tool-sep" />

        <ToolBtn tool="coord" active={false} kbd="J" tooltip="Hoppa till koordinat (J)" onClick={() => setCoordOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12z" /><circle cx="12" cy="10" r="2.5" />
          </svg>
        </ToolBtn>

        <div className="he-tool-sep" />

        {/* Rensa aktivt lager */}
        <div className="he-tool-wrap" data-tooltip={`Rensa ${activeTool !== 'select' ? activeTool : 'lager'}`}>
          <button
            className="he-tool"
            aria-label="Rensa aktivt lager"
            onClick={() => setConfirmClear(true)}
            style={{ color: 'var(--he-danger)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── CONTEXTUAL BAR ── */}
      {showCtxBar && selection && (
        <div className="he-ctx-bar" role="toolbar" aria-label="Markering">
          <div className="he-ctx-label">
            <span className="dot" style={{ background: selectedLayerColor }} />
            {selectedLayerLabel} markerad
            {selection.layer !== 'tee' ? ` · ${selectedPoints} punkter` : ''}
          </div>
          {selection.layer !== 'tee' && (
            <>
              <button className="he-ctx-btn" title="Infoga punkt" onClick={onInsertPoint}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Infoga punkt
              </button>
              <button className="he-ctx-btn" title="Förenkla polygon" onClick={onSimplify}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 17 9 11 13 15 21 7" />
                </svg>
                Förenkla
              </button>
              <button className="he-ctx-btn" title="Duplicera" onClick={onDuplicate}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" />
                </svg>
                Duplicera
              </button>
            </>
          )}
          <button className="he-ctx-btn danger" title="Ta bort markering (Delete)" onClick={onDeleteSelected}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
            </svg>
            Ta bort
          </button>
        </div>
      )}

      {/* ── RIGHT INSPECTOR ── */}
      <HoleEditorInspector
        hole={hole}
        fairwayPolygons={fairwayPolygons}
        teeToGreenMeters={teeToGreenMeters}
        selection={selection}
        visibility={visibility}
        locks={locks}
        onToggleVisibility={onToggleVisibility}
        onToggleLock={onToggleLock}
        onSetMeta={onSetMeta}
        onRequestResetAll={() => setConfirmReset(true)}
      />

      {/* ── HOLE STRIP ── */}
      <div className="he-hole-strip">
        {course.holes.map((h) => {
          const status = holeStatus(h);
          const isCurrent = h.holeNumber === selectedHole;
          return (
            <button
              key={h.id}
              className={`he-hole-chip${isCurrent ? ' current' : status ? ` ${status}` : ''}`}
              onClick={() => onSelectHole(h.holeNumber)}
              title={`Hål ${h.holeNumber}${h.par !== null ? ` · Par ${h.par}` : ''}`}
            >
              <span>{h.holeNumber}</span>
              {h.par !== null && <span className="par">P{h.par}</span>}
              <span className="status" />
            </button>
          );
        })}
      </div>

      {/* ── MAP CHROME ── */}
      <div className="he-map-chrome">
        <div className="he-chrome-group">
          <button
            className="he-chrome-btn"
            title="Zooma in"
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              map.zoomTo(Math.min(MAX_EDITOR_ZOOM, map.getZoom() + 1));
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            className="he-chrome-btn"
            title="Zooma ut"
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              map.zoomTo(Math.max(MIN_EDITOR_ZOOM, map.getZoom() - 1));
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
        <div className="he-chrome-group">
          <button
            className="he-chrome-btn"
            title="Centrera på tee"
            onClick={() => {
              const tp = hole.layout.teePoint;
              if (tp)
                mapRef.current?.flyTo({
                  center: [tp.lng, tp.lat],
                  zoom: 17,
                  essential: true,
                });
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="10" r="3" /><path d="M12 13v8M9 21h6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── HINT PILL ── */}
      <div className="he-hint">
        <span className="he-kbd">Space</span> håll = panorera ·{' '}
        pinch / 2-finger drag ·{' '}
        <span className="he-kbd">G</span> green ·{' '}
        <span className="he-kbd">⌘Z</span> ångra
      </div>

      {/* ── MODE INDICATOR (space held) ── */}
      <div className={`he-mode-indicator${isPanning ? ' show' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l-4 4 4 4M5 15h14M15 5l4 4-4 4" />
        </svg>
        Panorerar · håll <span className="he-kbd accent">Space</span>
      </div>

      {/* ── COORD JUMP POPOVER ── */}
      {coordOpen && (
        <div className="he-coord-popover">
          <h3>
            Hoppa till koordinat
            <button onClick={() => { setCoordOpen(false); setCoordInput(''); }}>✕</button>
          </h3>
          <input
            type="text"
            placeholder="lat, lng — t.ex. 57.7089, 11.9746"
            value={coordInput}
            onChange={(e) => setCoordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCoordJump();
              if (e.key === 'Escape') { setCoordOpen(false); setCoordInput(''); }
            }}
            autoFocus
          />
          <button className="he-btn-primary" onClick={handleCoordJump}>
            Gå dit
          </button>
        </div>
      )}

      {/* ── SHORTCUTS PANEL ── */}
      {showShortcuts && (
        <div className="he-shortcuts-panel">
          <h3>
            Kortkommandon
            <button onClick={() => setShowShortcuts(false)}>✕</button>
          </h3>
          {[
            ['V', 'Markera / Redigera'],
            ['T', 'Placera tee'],
            ['G', 'Rita green'],
            ['F', 'Rita fairway'],
            ['B', 'Rita bunker'],
            ['R', 'Rita träd'],
            ['O', 'Rita OB'],
            ['J', 'Hoppa till koordinat'],
            ['Space (håll)', 'Tillfällig panorering'],
            ['Esc', 'Avbryt / avmarkera'],
            ['Delete', 'Ta bort markering'],
            ['Enter', 'Slutför form'],
            ['⌘Z', 'Ångra'],
            ['⌘⇧Z', 'Gör om'],
            ['⌘S', 'Spara'],
            ['?', 'Visa kortkommandon'],
          ].map(([kbd, label]) => (
            <div key={kbd} className="he-sc-row">
              <span>{label}</span>
              <span className="he-kbd">{kbd}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── CONFIRM: CLEAR LAYER ── */}
      {confirmClear && (
        <div className="he-dialog-overlay">
          <div className="he-dialog-box">
            <h3>Rensa aktivt lager</h3>
            <p>Detta går att ångra med Undo. Vill du fortsätta?</p>
            <div className="he-dialog-actions">
              <button className="he-btn-cancel" onClick={() => setConfirmClear(false)}>Avbryt</button>
              <button className="he-btn-danger" onClick={() => { setConfirmClear(false); onClearLayer(); }}>Rensa</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM: RESET ALL ── */}
      {confirmReset && (
        <div className="he-dialog-overlay">
          <div className="he-dialog-box">
            <h3>Rensa hål-layout</h3>
            <p>Är du säker? Detta tar bort all ritad data för hålet (tee, green, fairway, bunker, träd och OB).</p>
            <div className="he-dialog-actions">
              <button className="he-btn-cancel" onClick={() => setConfirmReset(false)}>Avbryt</button>
              <button className="he-btn-danger" onClick={() => { setConfirmReset(false); onResetAll(); }}>Återställ</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EMPTY STATE TIP ── */}
      {showTip && !hole.layout.teePoint && !hole.layout.greenPolygon.length && (
        <div className="he-empty-overlay">
          <h3>Starta hål-layout</h3>
          <p>Börja med att placera tee (T), sedan rita green (G) och fairway (F).</p>
          <button
            className="he-btn-primary"
            style={{ marginTop: 4 }}
            onClick={dismissTip}
          >
            Förstått
          </button>
        </div>
      )}

      {/* ── TOASTS ── */}
      <div className="he-toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`he-toast${t.type === 'error' ? ' error' : ''}`}>
            <span className="dot" />
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ToolBtn helper ───────────────────────────────────────────────────────────

function ToolBtn({
  tool,
  active,
  kbd,
  tooltip,
  swatch,
  onClick,
  children,
}: {
  tool: string;
  active: boolean;
  kbd: string;
  tooltip: string;
  swatch?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="he-tool-wrap" data-tooltip={tooltip}>
      <button
        className={`he-tool${active ? ' active' : ''}`}
        aria-label={tooltip}
        aria-pressed={active}
        onClick={onClick}
      >
        {swatch && (
          <span className="swatch" style={{ background: swatch }} />
        )}
        {children}
        <span className="kbd">{kbd}</span>
      </button>
    </div>
  );
}
