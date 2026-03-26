import { centroid, lineString, length } from '@turf/turf';
import { Course } from './types';

export const computeHoleLength = (hole: Course['holes'][number]) => {
  if (!hole.layout.teePoint || hole.layout.greenPolygon.length < 3) return null;
  const greenCenter = centroid({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [hole.layout.greenPolygon.map((p) => [p.lng, p.lat])] },
    properties: {}
  });
  const track = lineString([
    [hole.layout.teePoint.lng, hole.layout.teePoint.lat],
    [greenCenter.geometry.coordinates[0], greenCenter.geometry.coordinates[1]]
  ]);
  return Math.round(length(track, { units: 'meters' }));
};

