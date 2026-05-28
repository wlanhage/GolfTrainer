import { Hole } from '../../lib/types';

export type HoleStatus = 'complete' | 'partial' | 'empty';

export function fairwaysOf(hole: Hole) {
  return hole.layout.fairwayPolygons ?? (hole.layout.fairwayPolygon.length ? [hole.layout.fairwayPolygon] : []);
}

export function holeChecks(hole: Hole) {
  const fairways = fairwaysOf(hole);
  return {
    metadata: hole.par !== null && hole.length !== null && hole.hcpIndex !== null,
    tee: Boolean(hole.layout.teePoint),
    green: hole.layout.greenPolygon.length >= 3,
    fairway: fairways.some((polygon) => polygon.length >= 3),
    length: hole.length === null || (hole.length > 30 && hole.length < 900)
  };
}

export function holeStatus(hole: Hole): HoleStatus {
  const checks = holeChecks(hole);
  const core = [checks.metadata, checks.tee, checks.green, checks.fairway];
  const done = core.filter(Boolean).length;
  if (done === core.length) return 'complete';
  if (done === 0) return 'empty';
  return 'partial';
}
