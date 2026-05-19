import { describe, expect, it } from 'vitest';
import {
  createEmptyLayoutGeometry,
  fromHoleLocalCoordinates,
  getBearingDegrees,
  getDistanceToGreenMeters,
  getGeoDistanceMeters,
  getPolygonCenter,
  hasRequiredLayout,
  normalizeLayoutGeometry,
  resolveHeatmapBearing,
  resolveHoleAxis,
  resolveLayoutMappingStatus
} from './holeGeometry';
import type { GeoPoint, HoleLayoutGeometry } from './types';

const STOCKHOLM: GeoPoint = { lat: 59.3293, lng: 18.0686 };
const GOTHENBURG: GeoPoint = { lat: 57.7089, lng: 11.9746 };

describe('getGeoDistanceMeters', () => {
  it('returns 0 for identical points', () => {
    expect(getGeoDistanceMeters(STOCKHOLM, STOCKHOLM)).toBe(0);
  });

  it('approximates Stockholm to Gothenburg as ~395 km', () => {
    const d = getGeoDistanceMeters(STOCKHOLM, GOTHENBURG);
    expect(d).toBeGreaterThan(390_000);
    expect(d).toBeLessThan(400_000);
  });

  it('symmetric', () => {
    const a = getGeoDistanceMeters(STOCKHOLM, GOTHENBURG);
    const b = getGeoDistanceMeters(GOTHENBURG, STOCKHOLM);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
  });
});

describe('getBearingDegrees', () => {
  it('returns value in [0, 360)', () => {
    const b = getBearingDegrees(STOCKHOLM, GOTHENBURG);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });

  it('point directly north has bearing near 0', () => {
    const south: GeoPoint = { lat: 59, lng: 18 };
    const north: GeoPoint = { lat: 60, lng: 18 };
    expect(getBearingDegrees(south, north)).toBeCloseTo(0, 0);
  });

  it('point directly east has bearing near 90', () => {
    const west: GeoPoint = { lat: 59, lng: 18 };
    const east: GeoPoint = { lat: 59, lng: 19 };
    expect(getBearingDegrees(west, east)).toBeCloseTo(90, 0);
  });
});

describe('getPolygonCenter', () => {
  it('returns null for empty polygon', () => {
    expect(getPolygonCenter([])).toBeNull();
  });

  it('returns average of points', () => {
    const center = getPolygonCenter([
      { lat: 0, lng: 0 },
      { lat: 2, lng: 0 },
      { lat: 2, lng: 2 },
      { lat: 0, lng: 2 }
    ]);
    expect(center).toEqual({ lat: 1, lng: 1 });
  });
});

const makeGeom = (overrides: Partial<HoleLayoutGeometry> = {}): HoleLayoutGeometry => ({
  ...createEmptyLayoutGeometry(),
  ...overrides
});

describe('resolveHoleAxis', () => {
  it('returns null without tee or green', () => {
    expect(resolveHoleAxis(createEmptyLayoutGeometry())).toBeNull();
  });

  it('returns null with tee but no green', () => {
    expect(resolveHoleAxis(makeGeom({ teePoint: STOCKHOLM }))).toBeNull();
  });

  it('returns axis with tee + green', () => {
    const axis = resolveHoleAxis(
      makeGeom({
        teePoint: { lat: 59, lng: 18 },
        greenPolygon: [
          { lat: 59.001, lng: 18 },
          { lat: 59.001, lng: 18.001 },
          { lat: 59, lng: 18.001 }
        ]
      })
    );
    expect(axis).not.toBeNull();
    expect(axis!.lengthMeters).toBeGreaterThan(0);
    expect(axis!.bearing).toBeGreaterThanOrEqual(0);
  });
});

describe('hasRequiredLayout', () => {
  it('false without tee', () => {
    expect(hasRequiredLayout(makeGeom())).toBe(false);
  });

  it('false with tee but green has < 3 points', () => {
    expect(hasRequiredLayout(makeGeom({ teePoint: STOCKHOLM, greenPolygon: [STOCKHOLM] }))).toBe(false);
  });

  it('true with tee + green polygon', () => {
    expect(
      hasRequiredLayout(
        makeGeom({
          teePoint: STOCKHOLM,
          greenPolygon: [
            { lat: 0, lng: 0 },
            { lat: 1, lng: 0 },
            { lat: 0, lng: 1 }
          ]
        })
      )
    ).toBe(true);
  });
});

describe('resolveLayoutMappingStatus', () => {
  it('not_started when empty', () => {
    expect(resolveLayoutMappingStatus(createEmptyLayoutGeometry())).toBe('not_started');
  });

  it('partial with only tee', () => {
    expect(resolveLayoutMappingStatus(makeGeom({ teePoint: STOCKHOLM }))).toBe('partial');
  });

  it('required_complete with tee + green', () => {
    expect(
      resolveLayoutMappingStatus(
        makeGeom({
          teePoint: STOCKHOLM,
          greenPolygon: [
            { lat: 0, lng: 0 },
            { lat: 1, lng: 0 },
            { lat: 0, lng: 1 }
          ]
        })
      )
    ).toBe('required_complete');
  });

  it('full with tee + green + fairway', () => {
    expect(
      resolveLayoutMappingStatus(
        makeGeom({
          teePoint: STOCKHOLM,
          greenPolygon: [
            { lat: 0, lng: 0 },
            { lat: 1, lng: 0 },
            { lat: 0, lng: 1 }
          ],
          fairwayPolygon: [
            { lat: 0, lng: 0 },
            { lat: 1, lng: 0 },
            { lat: 0, lng: 1 }
          ]
        })
      )
    ).toBe('full');
  });
});

describe('fromHoleLocalCoordinates', () => {
  it('returns origin when forward=0 lateral=0', () => {
    const origin = { lat: 59, lng: 18 };
    const r = fromHoleLocalCoordinates(origin, 0, 0, 0);
    expect(r.lat).toBeCloseTo(origin.lat, 6);
    expect(r.lng).toBeCloseTo(origin.lng, 6);
  });

  it('bearing 0 (north): forward moves lat up', () => {
    const origin = { lat: 59, lng: 18 };
    const r = fromHoleLocalCoordinates(origin, 0, 100, 0);
    expect(r.lat).toBeGreaterThan(origin.lat);
    expect(r.lng).toBeCloseTo(origin.lng, 4);
  });

  it('bearing 90 (east): forward moves lng up', () => {
    const origin = { lat: 59, lng: 18 };
    const r = fromHoleLocalCoordinates(origin, 90, 100, 0);
    expect(r.lng).toBeGreaterThan(origin.lng);
  });
});

describe('getDistanceToGreenMeters', () => {
  it('returns distance to nearest edge when player outside green', () => {
    const player = { lat: 59, lng: 18 };
    const green = [
      { lat: 59.001, lng: 18 },
      { lat: 59.001, lng: 18.001 },
      { lat: 59.001, lng: 18.002 }
    ];
    const d = getDistanceToGreenMeters(player, makeGeom({ greenPolygon: green }));
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThan(0);
  });

  it('returns null without green polygon', () => {
    const d = getDistanceToGreenMeters(STOCKHOLM, createEmptyLayoutGeometry());
    expect(d).toBeNull();
  });
});

describe('resolveHeatmapBearing', () => {
  it('prefers player -> green over tee-axis', () => {
    const playerPos = { lat: 59, lng: 18 };
    const teeNorth = { lat: 59.0001, lng: 18 };
    const greenSouth = [
      { lat: 58.99, lng: 18 },
      { lat: 58.99, lng: 18.0001 },
      { lat: 58.989, lng: 18 }
    ];
    const bearing = resolveHeatmapBearing(makeGeom({ teePoint: teeNorth, greenPolygon: greenSouth }), playerPos);
    // Player är norr om green → bearing ska peka söderut (~180)
    expect(bearing).not.toBeNull();
    expect(bearing!).toBeGreaterThan(170);
    expect(bearing!).toBeLessThan(190);
  });

  it('falls back to axis when no player', () => {
    const bearing = resolveHeatmapBearing(
      makeGeom({
        teePoint: { lat: 59, lng: 18 },
        greenPolygon: [
          { lat: 59.001, lng: 18 },
          { lat: 59.001, lng: 18.001 },
          { lat: 59, lng: 18.001 }
        ]
      }),
      null
    );
    expect(bearing).not.toBeNull();
  });

  it('returns null without enough geometry', () => {
    expect(resolveHeatmapBearing(createEmptyLayoutGeometry(), null)).toBeNull();
  });
});

describe('normalizeLayoutGeometry', () => {
  it('returns empty geometry from null', () => {
    expect(normalizeLayoutGeometry(null)).toEqual(createEmptyLayoutGeometry());
  });

  it('preserves tee + green', () => {
    const input = {
      teePoint: { lat: 1, lng: 2 },
      greenPolygon: [{ lat: 3, lng: 4 }, { lat: 5, lng: 6 }, { lat: 7, lng: 8 }]
    };
    const r = normalizeLayoutGeometry(input);
    expect(r.teePoint).toEqual({ lat: 1, lng: 2 });
    expect(r.greenPolygon).toHaveLength(3);
  });

  it('ignores invalid polygons in bunker', () => {
    const r = normalizeLayoutGeometry({ bunkerPolygons: [[{ bad: true }], [{ lat: 1, lng: 2 }]] });
    // first polygon: invalid (will be filtered to []), second: valid (1 point but kept after filter)
    expect(r.bunkerPolygons.length).toBeLessThanOrEqual(1);
  });
});
