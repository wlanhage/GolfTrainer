import { HoleLayoutGeometry, LayoutMappingStatus } from '../types/play';

const hasPolygon = (polygon: { lat: number; lng: number }[]) => polygon.length >= 3;

export const hasRequiredLayout = (geometry: HoleLayoutGeometry) => Boolean(geometry.teePoint && hasPolygon(geometry.greenPolygon));

export const resolveLayoutMappingStatus = (geometry: HoleLayoutGeometry): LayoutMappingStatus => {
  const hasTee = Boolean(geometry.teePoint);
  const hasGreen = hasPolygon(geometry.greenPolygon);

  if (!hasTee && !hasGreen) {
    return 'not_started';
  }

  if (!hasTee || !hasGreen) {
    return 'partial';
  }

  const hasOptional =
    hasPolygon(geometry.fairwayPolygon) ||
    geometry.bunkerPolygons.some(hasPolygon) ||
    geometry.treesPolygons.some(hasPolygon) ||
    geometry.obPolygons.some(hasPolygon);

  return hasOptional ? 'full' : 'required_complete';
};
