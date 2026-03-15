import { GeoPoint, HoleLayoutGeometry, HoleLayoutLayer } from '../types/play';

const MIN_POINTS_FOR_POLYGON = 3;

export const createEmptyLayoutGeometry = (): HoleLayoutGeometry => ({
  teePoint: null,
  greenPolygon: [],
  fairwayPolygon: [],
  bunkerPolygons: [],
  treesPolygons: [],
  obPolygons: []
});

export const simplifyStroke = (stroke: GeoPoint[]): GeoPoint[] => {
  if (stroke.length <= 10) return stroke;
  const simplified = stroke.filter((_, index) => index % 2 === 0);
  return simplified.length >= MIN_POINTS_FOR_POLYGON ? simplified : stroke;
};

const ensureClosedPolygon = (points: GeoPoint[]) => {
  if (points.length < MIN_POINTS_FOR_POLYGON) {
    return [];
  }

  const simplified = simplifyStroke(points);
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (first.lat === last.lat && first.lng === last.lng) {
    return simplified;
  }

  return [...simplified, first];
};

export const convertStrokeToPolygon = (stroke: GeoPoint[]) => ensureClosedPolygon(stroke);

export const applyPolygonToLayer = (geometry: HoleLayoutGeometry, layer: HoleLayoutLayer, polygon: GeoPoint[]): HoleLayoutGeometry => {
  switch (layer) {
    case 'green':
      return { ...geometry, greenPolygon: polygon };
    case 'fairway':
      return { ...geometry, fairwayPolygon: polygon };
    case 'bunker':
      return polygon.length ? { ...geometry, bunkerPolygons: [...geometry.bunkerPolygons, polygon] } : geometry;
    case 'trees':
      return polygon.length ? { ...geometry, treesPolygons: [...geometry.treesPolygons, polygon] } : geometry;
    case 'ob':
      return polygon.length ? { ...geometry, obPolygons: [...geometry.obPolygons, polygon] } : geometry;
    default:
      return geometry;
  }
};

export const clearLayer = (geometry: HoleLayoutGeometry, layer: HoleLayoutLayer): HoleLayoutGeometry => {
  switch (layer) {
    case 'tee':
      return { ...geometry, teePoint: null };
    case 'green':
      return { ...geometry, greenPolygon: [] };
    case 'fairway':
      return { ...geometry, fairwayPolygon: [] };
    case 'bunker':
      return { ...geometry, bunkerPolygons: [] };
    case 'trees':
      return { ...geometry, treesPolygons: [] };
    case 'ob':
      return { ...geometry, obPolygons: [] };
    default:
      return geometry;
  }
};

const normalizePoint = (point: any): GeoPoint | null => {
  if (point && typeof point.lat === 'number' && typeof point.lng === 'number') {
    return { lat: point.lat, lng: point.lng };
  }

  if (point && typeof point.x === 'number' && typeof point.y === 'number') {
    return { lat: point.y, lng: point.x };
  }

  return null;
};

const normalizePolygon = (polygon: any): GeoPoint[] => {
  if (!Array.isArray(polygon)) return [];
  return polygon.map(normalizePoint).filter((point): point is GeoPoint => Boolean(point));
};

export const normalizeLayoutGeometry = (geometry: any): HoleLayoutGeometry => {
  if (!geometry) return createEmptyLayoutGeometry();

  return {
    teePoint: normalizePoint(geometry.teePoint ?? geometry.teePosition),
    greenPolygon: normalizePolygon(geometry.greenPolygon ?? [geometry.greenPosition].filter(Boolean)),
    fairwayPolygon: normalizePolygon(geometry.fairwayPolygon ?? geometry.fairwayShape),
    bunkerPolygons: Array.isArray(geometry.bunkerPolygons)
      ? geometry.bunkerPolygons.map(normalizePolygon).filter((polygon: GeoPoint[]) => polygon.length > 0)
      : Array.isArray(geometry.bunkerShapes)
        ? geometry.bunkerShapes.map(normalizePolygon).filter((polygon: GeoPoint[]) => polygon.length > 0)
        : [],
    treesPolygons: Array.isArray(geometry.treesPolygons)
      ? geometry.treesPolygons.map(normalizePolygon).filter((polygon: GeoPoint[]) => polygon.length > 0)
      : Array.isArray(geometry.treeShapes)
        ? geometry.treeShapes.map(normalizePolygon).filter((polygon: GeoPoint[]) => polygon.length > 0)
        : [],
    obPolygons: Array.isArray(geometry.obPolygons)
      ? geometry.obPolygons.map(normalizePolygon).filter((polygon: GeoPoint[]) => polygon.length > 0)
      : Array.isArray(geometry.waterShapes)
        ? geometry.waterShapes.map(normalizePolygon).filter((polygon: GeoPoint[]) => polygon.length > 0)
        : []
  };
};
