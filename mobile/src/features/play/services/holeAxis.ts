import { GeoPoint, HoleAxis, HoleLayoutGeometry } from '../types/play';

const EARTH_RADIUS_M = 6371000;
const toRadians = (value: number) => (value * Math.PI) / 180;
const toDegrees = (value: number) => (value * 180) / Math.PI;

export const getGeoDistanceMeters = (from: GeoPoint, to: GeoPoint) => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

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
  const sum = polygon.reduce((acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }), { lat: 0, lng: 0 });

  return { lat: sum.lat / polygon.length, lng: sum.lng / polygon.length };
};

export const resolveHoleAxis = (geometry: HoleLayoutGeometry): HoleAxis | null => {
  if (!geometry.teePoint) return null;
  const greenCenter = getPolygonCenter(geometry.greenPolygon);
  if (!greenCenter) return null;

  const bearing = getBearingDegrees(geometry.teePoint, greenCenter);
  return {
    origin: geometry.teePoint,
    target: greenCenter,
    bearing,
    lengthMeters: getGeoDistanceMeters(geometry.teePoint, greenCenter),
    teeToGreenCenterline: [geometry.teePoint, greenCenter]
  };
};

export const toHoleLocalCoordinates = (origin: GeoPoint, bearing: number, point: GeoPoint) => {
  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.cos(toRadians(origin.lat));
  const deltaX = (point.lng - origin.lng) * metersPerLng;
  const deltaY = (point.lat - origin.lat) * metersPerLat;

  const theta = toRadians(90 - bearing);

  return {
    forward: deltaX * Math.cos(theta) + deltaY * Math.sin(theta),
    lateral: -deltaX * Math.sin(theta) + deltaY * Math.cos(theta)
  };
};
