import { HoleLayoutGeometry, LayoutMappingStatus } from '../types/play';

export const createEmptyLayoutGeometry = (): HoleLayoutGeometry => ({
  teePosition: null,
  greenPosition: null,
  fairwayShape: [],
  waterShapes: [],
  treeShapes: [],
  bunkerShapes: [],
  notes: ''
});

export const hasCoreLayoutPoints = (geometry: HoleLayoutGeometry) =>
  Boolean(geometry.teePosition && geometry.greenPosition);

export const resolveLayoutMappingStatus = (geometry: HoleLayoutGeometry): LayoutMappingStatus => {
  const hasAnyData =
    hasCoreLayoutPoints(geometry) ||
    geometry.fairwayShape.length > 0 ||
    geometry.waterShapes.length > 0 ||
    geometry.treeShapes.length > 0 ||
    geometry.bunkerShapes.length > 0 ||
    geometry.notes.trim().length > 0;

  if (!hasAnyData) {
    return 'not_started';
  }

  return hasCoreLayoutPoints(geometry) ? 'complete' : 'partial';
};

export const serializeLayoutGeometry = (geometry: HoleLayoutGeometry) => JSON.stringify(geometry);
export const deserializeLayoutGeometry = (value: string): HoleLayoutGeometry => JSON.parse(value) as HoleLayoutGeometry;
