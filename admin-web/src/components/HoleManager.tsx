'use client';

import { centroid, lineString, length } from '@turf/turf';
import { useMemo, useRef, useState } from 'react';
import { courseRepo } from '../lib/storage';
import { Course, GeoPoint, HoleLayoutGeometry } from '../lib/types';

type Props = {
  initialCourse: Course;
};

type Layer = 'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob';

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 420;
const DEFAULT_CENTER: GeoPoint = { lat: 59.3293, lng: 18.0686 };
const DEGREE_SPAN = 0.0042;

const closePolygon = (points: GeoPoint[]) => {
  if (points.length < 3) return [];
  const first = points[0];
  const last = points[points.length - 1];
  if (first.lat === last.lat && first.lng === last.lng) return points;
  return [...points, first];
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

const layerPalette: Record<Layer, string> = {
  tee: '#ef4444',
  green: '#22c55e',
  fairway: '#16a34a',
  bunker: '#f59e0b',
  trees: '#15803d',
  ob: '#dc2626'
};

export function HoleManager({ initialCourse }: Props) {
  const [course, setCourse] = useState<Course>(initialCourse);
  const [selectedHole, setSelectedHole] = useState(1);
  const [activeLayer, setActiveLayer] = useState<Layer>('tee');
  const [stroke, setStroke] = useState<GeoPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const hole = useMemo(() => course.holes.find((candidate) => candidate.holeNumber === selectedHole)!, [course.holes, selectedHole]);

  const center = hole.layout.teePoint ?? DEFAULT_CENTER;

  const toGeo = (clientX: number, clientY: number): GeoPoint | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    const lng = center.lng + (x / rect.width - 0.5) * DEGREE_SPAN;
    const lat = center.lat - (y / rect.height - 0.5) * DEGREE_SPAN;
    return { lat, lng };
  };

  const toCanvas = (p: GeoPoint): { x: number; y: number } => ({
    x: ((p.lng - center.lng) / DEGREE_SPAN + 0.5) * CANVAS_WIDTH,
    y: ((center.lat - p.lat) / DEGREE_SPAN + 0.5) * CANVAS_HEIGHT
  });

  const persistHole = (nextHole: typeof hole) => {
    const nextCourse = courseRepo.updateHole(course.id, hole.holeNumber, nextHole);
    if (nextCourse) setCourse(nextCourse);
  };

  const setMeta = (field: 'par' | 'length' | 'hcpIndex', value: string) => {
    const parsed = value.trim() ? Number(value) : null;
    persistHole({ ...hole, [field]: parsed });
  };

  const clearLayer = () => {
    const next = { ...hole.layout };
    if (activeLayer === 'tee') next.teePoint = null;
    if (activeLayer === 'green') next.greenPolygon = [];
    if (activeLayer === 'fairway') next.fairwayPolygon = [];
    if (activeLayer === 'bunker') next.bunkerPolygons = [];
    if (activeLayer === 'trees') next.treesPolygons = [];
    if (activeLayer === 'ob') next.obPolygons = [];
    persistHole({ ...hole, layout: next });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const geo = toGeo(event.clientX, event.clientY);
    if (!geo) return;
    setIsDrawing(true);
    setStroke([geo]);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing) return;
    const geo = toGeo(event.clientX, event.clientY);
    if (!geo) return;
    setStroke((prev) => [...prev, geo]);
  };

  const onPointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (stroke.length === 0) return;
    const nextLayout = applyToLayer(hole.layout, activeLayer, stroke);
    persistHole({ ...hole, layout: nextLayout });
    setStroke([]);
  };

  const teeToGreenMeters = useMemo(() => {
    if (!hole.layout.teePoint || hole.layout.greenPolygon.length < 3) return null;
    const greenCenter = centroid({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [hole.layout.greenPolygon.map((p) => [p.lng, p.lat])] },
      properties: {}
    });
    const target = greenCenter.geometry.coordinates;
    const track = lineString([
      [hole.layout.teePoint.lng, hole.layout.teePoint.lat],
      [target[0], target[1]]
    ]);

    return Math.round(length(track, { units: 'meters' }));
  }, [hole.layout.greenPolygon, hole.layout.teePoint]);

  const drawPolygon = (polygon: GeoPoint[], color: string, key: string) => {
    if (polygon.length < 3) return null;
    const points = polygon.map((p) => {
      const { x, y } = toCanvas(p);
      return `${x},${y}`;
    }).join(' ');
    return <polygon key={key} points={points} fill={`${color}66`} stroke={color} strokeWidth={2} />;
  };

  return (
    <div className="card-grid">
      <section className="card">
        <h2>{course.courseName}</h2>
        <p>{course.clubName} · {course.teeName}</p>
        <p>Flöde: välj lager → rita med "penna" på arbetsytan → metadata + spara automatiskt.</p>
        <div className="hole-list">
          {course.holes.map((item) => (
            <button key={item.id} className={selectedHole === item.holeNumber ? 'active-chip' : 'chip'} onClick={() => setSelectedHole(item.holeNumber)}>
              Hål {item.holeNumber}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Metadata (Hål {hole.holeNumber})</h2>
        <input placeholder="Par" value={hole.par ?? ''} onChange={(event) => setMeta('par', event.target.value)} />
        <input placeholder="Längd" value={hole.length ?? ''} onChange={(event) => setMeta('length', event.target.value)} />
        <input placeholder="HCP" value={hole.hcpIndex ?? ''} onChange={(event) => setMeta('hcpIndex', event.target.value)} />
        <p>Tee→Green (turf): {teeToGreenMeters ? `${teeToGreenMeters} m` : 'kräver tee + green polygon'}</p>
      </section>

      <section className="card">
        <h2>Ban-skapare (penna)</h2>
        <div className="hole-list">
          {(['tee', 'green', 'fairway', 'bunker', 'trees', 'ob'] as Layer[]).map((layer) => (
            <button key={layer} className={activeLayer === layer ? 'active-chip' : 'chip'} onClick={() => setActiveLayer(layer)}>
              {layer.toUpperCase()}
            </button>
          ))}
          <button className="chip" onClick={clearLayer}>Rensa aktivt lager</button>
        </div>

        <div
          ref={boardRef}
          className="draw-board"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <svg viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}>
            {drawPolygon(hole.layout.greenPolygon, layerPalette.green, 'green')}
            {drawPolygon(hole.layout.fairwayPolygon, layerPalette.fairway, 'fairway')}
            {hole.layout.bunkerPolygons.map((polygon, index) => drawPolygon(polygon, layerPalette.bunker, `bunker_${index}`))}
            {hole.layout.treesPolygons.map((polygon, index) => drawPolygon(polygon, layerPalette.trees, `trees_${index}`))}
            {hole.layout.obPolygons.map((polygon, index) => drawPolygon(polygon, layerPalette.ob, `ob_${index}`))}
            {hole.layout.teePoint ? (() => {
              const tee = toCanvas(hole.layout.teePoint);
              return <circle cx={tee.x} cy={tee.y} r={7} fill={layerPalette.tee} stroke="#fff" strokeWidth={2} />;
            })() : null}
            {stroke.length >= 2 ? (
              <polyline
                points={stroke.map((p) => {
                  const pos = toCanvas(p);
                  return `${pos.x},${pos.y}`;
                }).join(' ')}
                fill="none"
                stroke={layerPalette[activeLayer]}
                strokeWidth={3}
              />
            ) : null}
          </svg>
        </div>

        <p>Aktivt lager: <strong>{activeLayer.toUpperCase()}</strong>. Tee sparas som marker, övriga lager som polygoner.</p>
      </section>
    </div>
  );
}
