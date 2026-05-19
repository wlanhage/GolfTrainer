import type { GeoPoint, HoleLayoutGeometry, LayoutMappingStatus } from './types';

const EARTH_RADIUS_M = 6371000;
const toRadians = (v: number) => (v * Math.PI) / 180;
const toDegrees = (v: number) => (v * 180) / Math.PI;

export const getGeoDistanceMeters = (from: GeoPoint, to: GeoPoint) => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const getBearingDegrees = (from: GeoPoint, to: GeoPoint) => {
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

export const getPolygonCenter = (polygon: GeoPoint[]): GeoPoint | null => {
  if (polygon.length === 0) return null;
  const sum = polygon.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / polygon.length, lng: sum.lng / polygon.length };
};

export type HoleAxis = {
  origin: GeoPoint;
  target: GeoPoint;
  bearing: number;
  lengthMeters: number;
};

export const resolveHoleAxis = (geometry: HoleLayoutGeometry): HoleAxis | null => {
  if (!geometry.teePoint) return null;
  const greenCenter = getPolygonCenter(geometry.greenPolygon);
  if (!greenCenter) return null;
  return {
    origin: geometry.teePoint,
    target: greenCenter,
    bearing: getBearingDegrees(geometry.teePoint, greenCenter),
    lengthMeters: getGeoDistanceMeters(geometry.teePoint, greenCenter)
  };
};

/**
 * Bearing att använda när heatmap eller klubbrekommendation projiceras från
 * spelarens position. Föredrar spelare → green-center (gäller approach-skott),
 * annars hålets axis (tee → green) som fallback.
 */
export const resolveHeatmapBearing = (
  geometry: HoleLayoutGeometry,
  playerPosition: GeoPoint | null
): number | null => {
  const greenCenter = getPolygonCenter(geometry.greenPolygon);
  if (playerPosition && greenCenter) {
    return getBearingDegrees(playerPosition, greenCenter);
  }
  const axis = resolveHoleAxis(geometry);
  return axis?.bearing ?? null;
};

export const fromHoleLocalCoordinates = (origin: GeoPoint, bearing: number, forward: number, lateral: number): GeoPoint => {
  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.cos(toRadians(origin.lat));
  const theta = toRadians(90 - bearing);
  const deltaX = forward * Math.cos(theta) - lateral * Math.sin(theta);
  const deltaY = forward * Math.sin(theta) + lateral * Math.cos(theta);
  return { lat: origin.lat + deltaY / metersPerLat, lng: origin.lng + deltaX / metersPerLng };
};

const nearestPointOnSegment = (point: GeoPoint, start: GeoPoint, end: GeoPoint) => {
  const ax = start.lng;
  const ay = start.lat;
  const bx = end.lng;
  const by = end.lat;
  const px = point.lng;
  const py = point.lat;
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return start;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / ab2));
  return { lng: ax + abx * t, lat: ay + aby * t };
};

export const getDistanceToGreenMeters = (player: GeoPoint, geometry: HoleLayoutGeometry): number | null => {
  if (geometry.greenPolygon.length >= 3) {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < geometry.greenPolygon.length; i += 1) {
      const start = geometry.greenPolygon[i];
      const end = geometry.greenPolygon[(i + 1) % geometry.greenPolygon.length];
      const nearest = nearestPointOnSegment(player, start, end);
      min = Math.min(min, getGeoDistanceMeters(player, nearest));
    }
    return Number.isFinite(min) ? min : null;
  }
  const center = getPolygonCenter(geometry.greenPolygon);
  if (!center) return null;
  return getGeoDistanceMeters(player, center);
};

const hasPolygon = (p: GeoPoint[]) => p.length >= 3;
export const hasRequiredLayout = (g: HoleLayoutGeometry) => Boolean(g.teePoint && hasPolygon(g.greenPolygon));

export const resolveLayoutMappingStatus = (g: HoleLayoutGeometry): LayoutMappingStatus => {
  const hasTee = Boolean(g.teePoint);
  const hasGreen = hasPolygon(g.greenPolygon);
  if (!hasTee && !hasGreen) return 'not_started';
  if (!hasTee || !hasGreen) return 'partial';
  const optional = hasPolygon(g.fairwayPolygon) || g.bunkerPolygons.some(hasPolygon) || g.treesPolygons.some(hasPolygon) || g.obPolygons.some(hasPolygon);
  return optional ? 'full' : 'required_complete';
};

export const createEmptyLayoutGeometry = (): HoleLayoutGeometry => ({
  teePoint: null,
  greenPolygon: [],
  fairwayPolygon: [],
  bunkerPolygons: [],
  treesPolygons: [],
  obPolygons: []
});

const normalizePoint = (point: unknown): GeoPoint | null => {
  if (point && typeof point === 'object') {
    const p = point as Record<string, unknown>;
    if (typeof p.lat === 'number' && typeof p.lng === 'number') return { lat: p.lat, lng: p.lng };
    if (typeof p.x === 'number' && typeof p.y === 'number') return { lat: p.y, lng: p.x };
  }
  return null;
};

const normalizePolygon = (polygon: unknown): GeoPoint[] => {
  if (!Array.isArray(polygon)) return [];
  return polygon.map(normalizePoint).filter((p): p is GeoPoint => Boolean(p));
};

export const normalizeLayoutGeometry = (geometry: unknown): HoleLayoutGeometry => {
  if (!geometry || typeof geometry !== 'object') return createEmptyLayoutGeometry();
  const g = geometry as Record<string, unknown>;
  return {
    teePoint: normalizePoint(g.teePoint),
    greenPolygon: normalizePolygon(g.greenPolygon),
    fairwayPolygon: normalizePolygon(g.fairwayPolygon),
    bunkerPolygons: Array.isArray(g.bunkerPolygons) ? g.bunkerPolygons.map(normalizePolygon).filter((p) => p.length > 0) : [],
    treesPolygons: Array.isArray(g.treesPolygons) ? g.treesPolygons.map(normalizePolygon).filter((p) => p.length > 0) : [],
    obPolygons: Array.isArray(g.obPolygons) ? g.obPolygons.map(normalizePolygon).filter((p) => p.length > 0) : []
  };
};
