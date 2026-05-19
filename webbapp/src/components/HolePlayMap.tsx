'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { LngLatBoundsLike, Map as MlMap } from 'maplibre-gl';
import type { GeoPoint, HoleLayoutGeometry } from '@/lib/types';
import { fromHoleLocalCoordinates, resolveHoleAxis } from '@/lib/holeGeometry';
import { HEATMAP_BIN_SIZE_METERS } from '@/lib/heatmapConfig';
import { HOLE_COLORS } from '@/lib/holeColors';

export type CaddyMapHeatmap = {
  origin: GeoPoint;
  bearing: number;
  cells: Array<{
    id: string;
    forwardMeters: number;
    lateralMeters: number;
    count: number;
    percentage: number;
    intensity: number;
  }>;
};

type Props = {
  geometry: HoleLayoutGeometry;
  playerPosition: GeoPoint | null;
  caddyHeatmap?: CaddyMapHeatmap | null;
  /** holeNumber identifierar nuvarande hål — när det ändras tvingas en ny auto-fit. */
  holeKey: string | number;
  /** Inkrementera för att tvinga en ny auto-fit (t.ex. recenter-knapp). */
  recenterTick?: number;
};

const DEFAULT_CENTER: GeoPoint = { lat: 59.3293, lng: 18.0686 };
const TILE_STYLE = 'https://demotiles.maplibre.org/style.json';

// Padding mot skärmens kanter när vi auto-fittar. Ska matcha UI-överlay:
//   top: hole-header (titel + meta + distans) ~ 110 px
//   bottom: kontroll-strip (score + nästa) ~ 100 px
//   sides: ge plats för back-knapp, settings, heatmap-flik
const FIT_PADDING = { top: 110, bottom: 110, left: 56, right: 56 };

const toPolygon = (id: string, points: GeoPoint[], color: string) =>
  points.length >= 3
    ? {
        type: 'Feature' as const,
        id,
        properties: { color },
        geometry: { type: 'Polygon' as const, coordinates: [points.map((p) => [p.lng, p.lat])] }
      }
    : null;

const buildFeatureCollection = (geometry: HoleLayoutGeometry, player: GeoPoint | null) => {
  const features: GeoJSON.Feature[] = [];
  const green = toPolygon('green', geometry.greenPolygon, HOLE_COLORS.green);
  if (green) features.push(green);
  const fairway = toPolygon('fairway', geometry.fairwayPolygon, HOLE_COLORS.fairway);
  if (fairway) features.push(fairway);
  geometry.bunkerPolygons.forEach((p, i) => {
    const f = toPolygon(`bunker_${i}`, p, HOLE_COLORS.bunker);
    if (f) features.push(f);
  });
  geometry.treesPolygons.forEach((p, i) => {
    const f = toPolygon(`trees_${i}`, p, HOLE_COLORS.trees);
    if (f) features.push(f);
  });
  geometry.obPolygons.forEach((p, i) => {
    const f = toPolygon(`ob_${i}`, p, HOLE_COLORS.ob);
    if (f) features.push(f);
  });
  if (geometry.teePoint) {
    features.push({
      type: 'Feature',
      id: 'tee',
      properties: { color: HOLE_COLORS.tee },
      geometry: { type: 'Point', coordinates: [geometry.teePoint.lng, geometry.teePoint.lat] }
    });
  }
  if (player) {
    features.push({
      type: 'Feature',
      id: 'player',
      properties: { color: HOLE_COLORS.player },
      geometry: { type: 'Point', coordinates: [player.lng, player.lat] }
    });
  }
  return { type: 'FeatureCollection' as const, features };
};

const buildHeatmapFC = (heatmap: CaddyMapHeatmap | null | undefined) => {
  if (!heatmap) return { type: 'FeatureCollection' as const, features: [] };
  const half = HEATMAP_BIN_SIZE_METERS / 2;
  const features = heatmap.cells.map((cell) => {
    const corners = [
      { f: cell.forwardMeters - half, l: cell.lateralMeters - half },
      { f: cell.forwardMeters - half, l: cell.lateralMeters + half },
      { f: cell.forwardMeters + half, l: cell.lateralMeters + half },
      { f: cell.forwardMeters + half, l: cell.lateralMeters - half },
      { f: cell.forwardMeters - half, l: cell.lateralMeters - half }
    ];
    return {
      type: 'Feature' as const,
      id: cell.id,
      properties: { count: cell.count, percentage: `${cell.percentage}%`, intensity: cell.intensity },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          corners.map((c) => {
            const p = fromHoleLocalCoordinates(heatmap.origin, heatmap.bearing, c.f, c.l);
            return [p.lng, p.lat];
          })
        ]
      }
    };
  });
  return { type: 'FeatureCollection' as const, features };
};

/**
 * Beräknar bounds som rymmer spelaren + green-polygonen (eller tee om inget annat finns).
 * Returnerar null om vi inte har tillräckligt för en meningsfull ram.
 */
const computeHoleBounds = (
  geometry: HoleLayoutGeometry,
  playerPosition: GeoPoint | null
): LngLatBoundsLike | null => {
  const points: GeoPoint[] = [];
  if (playerPosition) points.push(playerPosition);
  else if (geometry.teePoint) points.push(geometry.teePoint);

  if (geometry.greenPolygon.length >= 3) {
    points.push(...geometry.greenPolygon);
  } else if (geometry.teePoint && playerPosition) {
    // Inget grönt — vi har minst tee + spelare. Annars för få punkter.
    points.push(geometry.teePoint);
  }

  if (points.length < 2) return null;

  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  ];
};

export function HolePlayMap({ geometry, playerPosition, caddyHeatmap, holeKey, recenterTick = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  // Spårar både holeKey + has-player + geometry-referens — refit triggas om någon ändrats.
  const fittedRef = useRef<{ key: string; geometry: HoleLayoutGeometry | null }>({ key: '', geometry: null });

  const axis = useMemo(() => resolveHoleAxis(geometry), [geometry]);
  const initialCenter = playerPosition ?? geometry.teePoint ?? axis?.origin ?? DEFAULT_CENTER;
  const shapes = useMemo(() => buildFeatureCollection(geometry, playerPosition), [geometry, playerPosition]);
  const heatmap = useMemo(() => buildHeatmapFC(caddyHeatmap), [caddyHeatmap]);

  const fitToHole = (animate: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = computeHoleBounds(geometry, playerPosition);
    if (!bounds) {
      map.easeTo({ center: [initialCenter.lng, initialCenter.lat], zoom: 16, bearing: axis?.bearing ?? 0, duration: animate ? 400 : 0 });
      return;
    }
    map.fitBounds(bounds, {
      bearing: axis?.bearing ?? 0,
      padding: FIT_PADDING,
      duration: animate ? 600 : 0,
      maxZoom: 18
    });
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: [initialCenter.lng, initialCenter.lat],
      zoom: 16,
      bearing: axis?.bearing ?? 0,
      attributionControl: false
    });
    map.on('load', () => {
      map.addSource('hole-shapes', { type: 'geojson', data: shapes });
      map.addLayer({
        id: 'hole-polys',
        type: 'fill',
        source: 'hole-shapes',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': ['get', 'color'] }
      });
      map.addLayer({
        id: 'hole-points',
        type: 'circle',
        source: 'hole-shapes',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-color': ['get', 'color'], 'circle-radius': 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 }
      });
      map.addSource('caddy-heatmap', { type: 'geojson', data: heatmap });
      map.addLayer({
        id: 'caddy-heatmap-fill',
        type: 'fill',
        source: 'caddy-heatmap',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'intensity'],
            0,
            '#f1f5f9',
            0.25,
            '#f0f1d9',
            0.5,
            '#dfee9a',
            0.75,
            '#bbeb6c',
            1,
            '#22c55e'
          ],
          'fill-opacity': 0.72,
          'fill-outline-color': '#14532d'
        }
      });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uppdatera shapes + heatmap data när props ändras.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const src = map.getSource('hole-shapes') as maplibregl.GeoJSONSource | undefined;
      src?.setData(shapes);
      const h = map.getSource('caddy-heatmap') as maplibregl.GeoJSONSource | undefined;
      h?.setData(heatmap);
    };
    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [shapes, heatmap]);

  // Auto-fit per hål. Triggar när vi byter hål, eller när spelarposition först
  // kommer in, eller när geometry-objektet ersätts (t.ex. efter admin-edit).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const key = `${holeKey}::${playerPosition ? 'p' : 'np'}`;
    if (fittedRef.current.key === key && fittedRef.current.geometry === geometry) return;

    const run = () => {
      fitToHole(true);
      fittedRef.current = { key, geometry };
    };
    if (map.isStyleLoaded()) run();
    else map.once('load', run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeKey, playerPosition, geometry]);

  // Manuell recenter — triggar varje gång tick ändras (utöver auto-fit ovan).
  useEffect(() => {
    if (recenterTick === 0) return;
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) fitToHole(true);
    else map.once('load', () => fitToHole(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterTick]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
