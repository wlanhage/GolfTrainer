import { GeoPoint, HoleLayoutGeometry } from '../types/play';
import { getGeoDistanceMeters, getPolygonCenter } from './holeAxis';

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
    let minDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < geometry.greenPolygon.length; i += 1) {
      const start = geometry.greenPolygon[i];
      const end = geometry.greenPolygon[(i + 1) % geometry.greenPolygon.length];
      const nearest = nearestPointOnSegment(player, start, end);
      minDistance = Math.min(minDistance, getGeoDistanceMeters(player, nearest));
    }

    return Number.isFinite(minDistance) ? minDistance : null;
  }

  const center = getPolygonCenter(geometry.greenPolygon);
  if (!center) return null;

  return getGeoDistanceMeters(player, center);
};
