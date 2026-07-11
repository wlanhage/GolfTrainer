'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { LngLatBoundsLike, Map as MlMap } from 'maplibre-gl';
import type { GeoPoint, HoleLayoutGeometry } from '@/lib/types';
import { fromHoleLocalCoordinates, getGeoDistanceMeters, resolveHoleAxis } from '@/lib/holeGeometry';
import { HEATMAP_BIN_SIZE_METERS } from '@/lib/heatmapConfig';
import { HOLE_COLORS } from '@/lib/holeColors';
import { DEFAULT_MAP_STYLE } from '@/lib/mapStyle';

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
  /** Öppna kandidatgreener för aktuellt hål (endast när hålet saknar green). */
  greenCandidates?: Array<{ id: string; polygon: GeoPoint[] }>;
  /** Anropas när spelaren trycker på en kandidat. */
  onCandidateTap?: (id: string) => void;
  /** Markerad kandidat (highlightas; övriga dimmas). */
  selectedCandidateId?: string | null;
};

const DEFAULT_CENTER: GeoPoint = { lat: 59.3293, lng: 18.0686 };

// Padding mot skärmens kanter när vi auto-fittar UI-överlay:
// top: hole-header + distans-pill ~110 px, bottom: score-strip ~100 px,
// sides: ge plats för back-knapp, settings, heatmap-flik.
const FIT_PADDING = { top: 110, bottom: 110, left: 56, right: 56 };
const FIT_DURATION_MS = 600;
const PLAYER_MOVE_DURATION_MS = 700;

// Empty FCs — pre-allokerade för att slippa skapa nya på varje render
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] as GeoJSON.Feature[] };

// ─── Feature builders ───────────────────────────────────────────────────────

const toPolygon = (id: string, points: GeoPoint[], color: string, kind: string) =>
  points.length >= 3
    ? {
        type: 'Feature' as const,
        id,
        properties: { color, kind },
        geometry: { type: 'Polygon' as const, coordinates: [points.map((p) => [p.lng, p.lat])] }
      }
    : null;

/** Statisk layout (polygoner + tee). Ändras bara när banan/hålet byter.
 *
 * Vi inkluderar fortfarande alla polygoner i feature-collectionen så att
 * geometriska beräkningar (avstånd-till-green, tap-target etc.) kan
 * använda dem — men i play-mode renderar vi bara green-polygonen, och då
 * med låg opacitet. Övriga lager är osynliga; spelaren ska se kartan, inte
 * ritningar. */
const buildLayoutFC = (geometry: HoleLayoutGeometry) => {
  const features: GeoJSON.Feature[] = [];
  const green = toPolygon('green', geometry.greenPolygon, HOLE_COLORS.green, 'green');
  if (green) features.push(green);
  const fairway = toPolygon('fairway', geometry.fairwayPolygon, HOLE_COLORS.fairway, 'fairway');
  if (fairway) features.push(fairway);
  geometry.bunkerPolygons.forEach((p, i) => {
    const f = toPolygon(`bunker_${i}`, p, HOLE_COLORS.bunker, 'bunker');
    if (f) features.push(f);
  });
  geometry.treesPolygons.forEach((p, i) => {
    const f = toPolygon(`trees_${i}`, p, HOLE_COLORS.trees, 'trees');
    if (f) features.push(f);
  });
  geometry.obPolygons.forEach((p, i) => {
    const f = toPolygon(`ob_${i}`, p, HOLE_COLORS.ob, 'ob');
    if (f) features.push(f);
  });
  if (geometry.teePoint) {
    features.push({
      type: 'Feature',
      id: 'tee',
      properties: { color: HOLE_COLORS.tee, kind: 'tee' },
      geometry: { type: 'Point', coordinates: [geometry.teePoint.lng, geometry.teePoint.lat] }
    });
  }
  return { type: 'FeatureCollection' as const, features };
};

/** Bara spelaren — uppdateras frekvent från GPS. */
const buildPlayerFC = (player: GeoPoint | null) => {
  if (!player) return EMPTY_FC;
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        id: 'player',
        properties: { color: HOLE_COLORS.player },
        geometry: { type: 'Point' as const, coordinates: [player.lng, player.lat] }
      }
    ]
  };
};

const buildHeatmapFC = (heatmap: CaddyMapHeatmap | null | undefined) => {
  if (!heatmap || heatmap.cells.length === 0) return EMPTY_FC;
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

/** Kandidatgreener (öppna, ej bekräftade) — ring + centrum-pin per kandidat.
 * Renderas i icke-gröna, högkontrastfärger (amber/vit, teal vid val) så de
 * aldrig smälter in i satellitgräset. */
const buildCandidateFC = (
  candidates: Array<{ id: string; polygon: GeoPoint[] }>,
  selectedId: string | null | undefined
) => {
  const features: GeoJSON.Feature[] = [];
  for (const c of candidates) {
    if (c.polygon.length < 3) continue;
    const selected = c.id === selectedId;
    features.push({
      type: 'Feature',
      id: `${c.id}-ring`,
      properties: { candidateId: c.id, selected },
      geometry: { type: 'Polygon', coordinates: [c.polygon.map((p) => [p.lng, p.lat])] }
    });
    const cx = c.polygon.reduce((s, p) => s + p.lng, 0) / c.polygon.length;
    const cy = c.polygon.reduce((s, p) => s + p.lat, 0) / c.polygon.length;
    features.push({
      type: 'Feature',
      id: `${c.id}-pin`,
      properties: { candidateId: c.id, selected },
      geometry: { type: 'Point', coordinates: [cx, cy] }
    });
  }
  return { type: 'FeatureCollection' as const, features };
};

/** Bounds som rymmer spelare + green (eller tee/kandidatgreener om mindre tillgängligt). */
const computeHoleBounds = (
  geometry: HoleLayoutGeometry,
  playerPosition: GeoPoint | null,
  candidates: Array<{ id: string; polygon: GeoPoint[] }> = []
): LngLatBoundsLike | null => {
  const points: GeoPoint[] = [];
  if (playerPosition) points.push(playerPosition);
  else if (geometry.teePoint) points.push(geometry.teePoint);

  if (geometry.greenPolygon.length >= 3) {
    points.push(...geometry.greenPolygon);
  } else {
    // Ingen bekräftad green ännu — ramen måste rymma kandidatgreenerna,
    // annars hamnar de utanför vyn och går inte att trycka på (t.ex. utan GPS).
    for (const c of candidates) {
      if (c.polygon.length >= 3) points.push(...c.polygon);
    }
    if (geometry.teePoint) points.push(geometry.teePoint);
  }
  if (points.length < 2) return null;

  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  ];
};

// ─── Component ──────────────────────────────────────────────────────────────

export function HolePlayMap({
  geometry,
  playerPosition,
  caddyHeatmap,
  holeKey,
  recenterTick = 0,
  greenCandidates,
  onCandidateTap,
  selectedCandidateId
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [userMoved, setUserMoved] = useState(false);
  // Flagga som temporärt stänger av userMoved-detektion när vi själva animerar kameran
  const programmaticMoveRef = useRef(false);

  // Tap-to-measure state
  const [tapDistance, setTapDistance] = useState<number | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerPosRef = useRef<GeoPoint | null>(playerPosition);
  playerPosRef.current = playerPosition;

  // Ref för tap-callbacken — click-handlers på candidate-lagren registreras
  // EN gång (i init-effekten) och läser callbacken via ref, så de inte
  // behöver omregistreras vid varje render.
  const onCandidateTapRef = useRef<((id: string) => void) | undefined>(onCandidateTap);
  onCandidateTapRef.current = onCandidateTap;

  const fittedRef = useRef<{ key: string; geometry: HoleLayoutGeometry | null }>({ key: '', geometry: null });

  const axis = useMemo(() => resolveHoleAxis(geometry), [geometry]);
  // Mittpunkt över alla kandidatgreener — används som fallback-centrering när
  // hålet saknar green/tee/GPS, så kartan öppnar vid kandidaterna (ej default).
  const candidateCenter = useMemo(() => {
    const pts = (greenCandidates ?? []).flatMap((c) => (c.polygon.length >= 3 ? c.polygon : []));
    if (pts.length === 0) return null;
    return {
      lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
      lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length
    };
  }, [greenCandidates]);
  const initialCenter =
    playerPosition ?? geometry.teePoint ?? candidateCenter ?? axis?.origin ?? DEFAULT_CENTER;

  // Memoizeade feature collections — uppladdas bara när relevanta props ändras
  const layoutFC = useMemo(() => buildLayoutFC(geometry), [geometry]);
  const playerFC = useMemo(() => buildPlayerFC(playerPosition), [playerPosition]);
  const heatmapFC = useMemo(() => buildHeatmapFC(caddyHeatmap), [caddyHeatmap]);
  const candidatesFC = useMemo(
    () => buildCandidateFC(greenCandidates ?? [], selectedCandidateId),
    [greenCandidates, selectedCandidateId]
  );

  const fitToHole = (animate: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    programmaticMoveRef.current = true;
    const bounds = computeHoleBounds(geometry, playerPosition, greenCandidates ?? []);
    if (!bounds) {
      map.easeTo({
        center: [initialCenter.lng, initialCenter.lat],
        zoom: 16,
        bearing: axis?.bearing ?? 0,
        duration: animate ? 400 : 0
      });
    } else {
      map.fitBounds(bounds, {
        bearing: axis?.bearing ?? 0,
        padding: FIT_PADDING,
        duration: animate ? FIT_DURATION_MS : 0,
        maxZoom: 18,
        essential: true
      });
    }
    setUserMoved(false);
  };

  // Init map — körs en gång
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_MAP_STYLE,
      center: [initialCenter.lng, initialCenter.lat],
      zoom: 16,
      bearing: axis?.bearing ?? 0,
      attributionControl: { compact: true },
      maxZoom: 19, // Esri stödjer 19
      fadeDuration: 150, // snabbare tile-fade
      refreshExpiredTiles: false, // mindre nätverk
      trackResize: true
    });

    map.on('load', () => {
      // Sources
      map.addSource('layout', { type: 'geojson', data: layoutFC });
      map.addSource('caddy-heatmap', { type: 'geojson', data: heatmapFC });
      map.addSource('player', { type: 'geojson', data: playerFC });

      // Heatmap underst (under layout-fyllningar och spelare)
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
          'fill-opacity': 0.65,
          'fill-outline-color': '#14532d'
        }
      });

      // Play-mode: vi visar BARA en svag highlight av green-polygonen så
      // spelaren ser ungefär vart han siktar. Fairway, bunker, trees, OB
      // är osynliga — kartan ska tala för sig själv. Polygonerna finns
      // kvar i source-datat så avstånds- och tap-target-logiken kan
      // använda dem, de bara renderas inte.
      map.addLayer({
        id: 'layout-green-highlight',
        type: 'fill',
        source: 'layout',
        filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'kind'], 'green']],
        paint: {
          'fill-color': HOLE_COLORS.green,
          'fill-opacity': 0.18,
          'fill-outline-color': HOLE_COLORS.green
        }
      });

      // Tee-markeringen renderas inte i play-mode — den ser ut som
      // spelarens egen position och skapar förvirring. Tee-punkten finns
      // kvar i source-datat för avståndsberäkningar och fit-to-hole.

      // Spelar-marker överst — pulserande halo + kärna
      map.addLayer({
        id: 'player-halo',
        type: 'circle',
        source: 'player',
        paint: {
          'circle-color': HOLE_COLORS.player,
          'circle-radius': 14,
          'circle-opacity': 0.25
        }
      });
      map.addLayer({
        id: 'player-core',
        type: 'circle',
        source: 'player',
        paint: {
          'circle-color': HOLE_COLORS.player,
          'circle-radius': 7,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5
        }
      });

      // Tap-target marker source + layer (empty initially)
      map.addSource('tap-target', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'tap-target-ring',
        type: 'circle',
        source: 'tap-target',
        paint: {
          'circle-color': 'transparent',
          'circle-radius': 10,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
          'circle-stroke-opacity': 0.9
        }
      });
      map.addLayer({
        id: 'tap-target-dot',
        type: 'circle',
        source: 'tap-target',
        paint: {
          'circle-color': '#ffffff',
          'circle-radius': 3.5,
          'circle-opacity': 0.9
        }
      });

      // Kandidatgreener — högst upp (ovanpå satellite-base + övriga lager)
      // så de alltid syns tydligt. Icke-gröna färger med avsikt: amber/vit
      // (öppen), teal (vald) — greent smälter annars in i satellitgräset.
      map.addSource('candidates', { type: 'geojson', data: candidatesFC });
      map.addLayer({
        id: 'candidate-fill',
        type: 'fill',
        source: 'candidates',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': ['case', ['get', 'selected'], '#1D9E75', '#EF9F27'],
          'fill-opacity': ['case', ['get', 'selected'], 0.35, 0.18]
        }
      });
      map.addLayer({
        id: 'candidate-outline',
        type: 'line',
        source: 'candidates',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'line-color': ['case', ['get', 'selected'], '#0F6E56', '#FFFFFF'],
          'line-width': 3
        }
      });
      map.addLayer({
        id: 'candidate-pin',
        type: 'circle',
        source: 'candidates',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 11,
          'circle-color': ['case', ['get', 'selected'], '#1D9E75', '#FFFFFF'],
          'circle-stroke-color': '#0F6E56',
          'circle-stroke-width': 3
        }
      });

      // Tap-handlers för kandidaterna — registreras EN gång här; callbacken
      // läses via ref så vi slipper omregistrera vid varje render.
      for (const layerId of ['candidate-pin', 'candidate-fill']) {
        map.on('click', layerId, (e) => {
          const id = e.features?.[0]?.properties?.candidateId;
          if (id && onCandidateTapRef.current) onCandidateTapRef.current(String(id));
        });
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      setLoaded(true);
    });

    // Tap-to-measure: click on map shows distance from player.
    // Hoppa över om tappet träffade en kandidatgreen — det trycket hanteras
    // av candidate-lagrens egna click-handlers (öppnar bekräftelse-sheet
    // istället för avstånds-toasten).
    map.on('click', (e) => {
      if (map.getLayer('candidate-pin')) {
        const hitCandidate = map.queryRenderedFeatures(e.point, {
          layers: ['candidate-pin', 'candidate-fill']
        });
        if (hitCandidate.length > 0) return;
      }
      const pos = playerPosRef.current;
      if (!pos) return;
      const tapped: GeoPoint = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      const dist = getGeoDistanceMeters(pos, tapped);
      setTapDistance(Math.round(dist));

      // Show tap marker on map
      const src = map.getSource('tap-target') as maplibregl.GeoJSONSource | undefined;
      src?.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [tapped.lng, tapped.lat] }
        }]
      });

      // Auto-hide after 4 seconds
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => {
        setTapDistance(null);
        const s = map.getSource('tap-target') as maplibregl.GeoJSONSource | undefined;
        s?.setData(EMPTY_FC);
      }, 4000);
    });

    // Detektera när användaren manuellt rör kameran (drag/zoom/rotate)
    const onMoveEnd = (e: maplibregl.MapLibreEvent) => {
      // Om händelsen var programmatisk (vår egen fitToHole), ignorera
      if (programmaticMoveRef.current) {
        programmaticMoveRef.current = false;
        return;
      }
      // Om event har originalEvent betyder det touch/mouse — användaren rörde kameran
      if ((e as unknown as { originalEvent?: unknown }).originalEvent) {
        setUserMoved(true);
      }
    };
    map.on('moveend', onMoveEnd);
    map.on('zoomend', onMoveEnd);
    map.on('rotateend', onMoveEnd);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Layout-uppdatering — endast när hål-geometri byter
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const src = map.getSource('layout') as maplibregl.GeoJSONSource | undefined;
    src?.setData(layoutFC);
  }, [layoutFC, loaded]);

  // Player-uppdatering — frekvent från GPS, animeras via easeTo separat från setData
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const src = map.getSource('player') as maplibregl.GeoJSONSource | undefined;
    src?.setData(playerFC);
  }, [playerFC, loaded]);

  // Heatmap-uppdatering — bara när cellerna ändras
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const src = map.getSource('caddy-heatmap') as maplibregl.GeoJSONSource | undefined;
    src?.setData(heatmapFC);
  }, [heatmapFC, loaded]);

  // Kandidatgreener-uppdatering — när listan eller markerat val ändras
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const src = map.getSource('candidates') as maplibregl.GeoJSONSource | undefined;
    src?.setData(candidatesFC);
  }, [candidatesFC, loaded]);

  // Auto-fit per hål eller när spelar-position först kommer in
  useEffect(() => {
    if (!loaded) return;
    const map = mapRef.current;
    if (!map) return;
    // Kandidat-signaturen ingår i nyckeln så att kartan om-fittar när
    // kandidatgreenerna laddats in asynkront (efter första fit på ett tomt hål).
    const candKey = (greenCandidates ?? []).map((c) => c.id).join(',');
    const key = `${holeKey}::${playerPosition ? 'p' : 'np'}::${candKey}`;
    if (fittedRef.current.key === key && fittedRef.current.geometry === geometry) return;
    fitToHole(true);
    fittedRef.current = { key, geometry };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeKey, playerPosition, geometry, greenCandidates, loaded]);

  // Manuell recenter
  useEffect(() => {
    if (recenterTick === 0 || !loaded) return;
    fitToHole(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterTick, loaded]);

  // Clear tap distance when hole changes
  useEffect(() => {
    setTapDistance(null);
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    const map = mapRef.current;
    if (map && loaded) {
      const src = map.getSource('tap-target') as maplibregl.GeoJSONSource | undefined;
      src?.setData(EMPTY_FC);
    }
  }, [holeKey, loaded]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Distance toast — replaces on each tap */}
      {tapDistance !== null && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/75 backdrop-blur-sm text-white font-bold text-sm rounded-full px-4 py-2 shadow-lg whitespace-nowrap">
            📍 {tapDistance} m
          </div>
        </div>
      )}

      {!loaded ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm pointer-events-none">
          <div className="text-white/80 text-sm font-semibold">Laddar karta...</div>
        </div>
      ) : null}
      {loaded && userMoved ? (
        <button
          type="button"
          onClick={() => fitToHole(true)}
          aria-label="Återställ kartvy"
          className="absolute left-1/2 -translate-x-1/2 bottom-24 z-10 flex items-center gap-1.5 bg-primary text-white font-semibold rounded-full px-4 py-2 shadow-lg text-sm border border-white/20 backdrop-blur-sm active:opacity-80 animate-[fade-in_0.2s_ease-out]"
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
          <span className="text-base leading-none">⌖</span>
          <span>Återställ vy</span>
        </button>
      ) : null}
    </div>
  );
}
