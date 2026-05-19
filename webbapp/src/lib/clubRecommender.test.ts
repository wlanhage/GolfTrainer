import { describe, expect, it } from 'vitest';
import { recommendClub } from './clubRecommender';
import type { CaddyClubSummary, CaddyShot, GeoPoint, HoleLayoutGeometry } from './types';
import { createEmptyLayoutGeometry } from './holeGeometry';

const makeSummary = (overrides: Partial<CaddyClubSummary>): CaddyClubSummary => ({
  clubKey: 'iron-7',
  clubLabel: 'Iron 7',
  sampleCount: 10,
  trimmedSampleCount: 10,
  trimPercentEachSide: 0,
  distanceMeters: 130,
  dispersionMeters: 8,
  ...overrides
});

describe('recommendClub', () => {
  it('returns null when no clubs have data', () => {
    expect(
      recommendClub({
        summaries: [],
        shotsByClub: new Map(),
        geometry: null,
        playerPosition: null
      })
    ).toBeNull();
  });

  it('returns null when no clubs have distanceMeters', () => {
    expect(
      recommendClub({
        summaries: [makeSummary({ distanceMeters: undefined })],
        shotsByClub: new Map(),
        geometry: null,
        playerPosition: null
      })
    ).toBeNull();
  });

  it('falls back to driver when no player position', () => {
    const clubs = [
      makeSummary({ clubKey: 'driver', distanceMeters: 240, dispersionMeters: 20 }),
      makeSummary({ clubKey: 'iron-7', distanceMeters: 130, dispersionMeters: 8 })
    ];
    const r = recommendClub({
      summaries: clubs,
      shotsByClub: new Map(),
      geometry: null,
      playerPosition: null
    });
    expect(r?.clubKey).toBe('driver');
    expect(r?.reason).toBe('driver_fallback');
  });

  it('falls back to longest-minus-dispersion when no driver and no position', () => {
    const clubs = [
      makeSummary({ clubKey: 'iron-7', distanceMeters: 130, dispersionMeters: 5 }),
      makeSummary({ clubKey: 'iron-5', distanceMeters: 160, dispersionMeters: 12 })
      // 130-5=125 vs 160-12=148 → iron-5
    ];
    const r = recommendClub({
      summaries: clubs,
      shotsByClub: new Map(),
      geometry: null,
      playerPosition: null
    });
    expect(r?.clubKey).toBe('iron-5');
    expect(r?.reason).toBe('longest_safe');
  });

  it('picks driver fallback when no club can reach green', () => {
    const player: GeoPoint = { lat: 59, lng: 18 };
    const farGreen = [
      { lat: 59.01, lng: 18 }, // ~1.1 km away
      { lat: 59.01, lng: 18.001 },
      { lat: 59.009, lng: 18 }
    ];
    const geom: HoleLayoutGeometry = { ...createEmptyLayoutGeometry(), greenPolygon: farGreen, teePoint: player };

    const clubs = [
      makeSummary({ clubKey: 'iron-7', distanceMeters: 130 }),
      makeSummary({ clubKey: 'driver', distanceMeters: 240, dispersionMeters: 25 })
    ];
    const r = recommendClub({
      summaries: clubs,
      shotsByClub: new Map(),
      geometry: geom,
      playerPosition: player
    });
    expect(r?.reason).toBe('driver_fallback');
  });

  it('picks club with best green-hit ratio when shots are provided', () => {
    const player: GeoPoint = { lat: 59, lng: 18 };
    // Green ~110m norr om player
    const green: GeoPoint[] = [
      { lat: 59.001, lng: 17.9999 },
      { lat: 59.001, lng: 18.0001 },
      { lat: 59.0008, lng: 18 }
    ];
    const geom: HoleLayoutGeometry = { ...createEmptyLayoutGeometry(), greenPolygon: green, teePoint: player };

    // Both clubs reach (110m). Iron-7 hits dead center (lateral 0). Iron-9 sprutar 30m åt sidan.
    const goodShots: CaddyShot[] = [
      { id: '1', clubKey: 'iron-7', distanceMeters: 110, lateralOffsetMeters: 0, recordedAt: 'x' },
      { id: '2', clubKey: 'iron-7', distanceMeters: 110, lateralOffsetMeters: 0, recordedAt: 'x' }
    ];
    const badShots: CaddyShot[] = [
      { id: '3', clubKey: 'iron-9', distanceMeters: 110, lateralOffsetMeters: 30, recordedAt: 'x' },
      { id: '4', clubKey: 'iron-9', distanceMeters: 110, lateralOffsetMeters: -30, recordedAt: 'x' }
    ];

    const clubs = [
      makeSummary({ clubKey: 'iron-7', distanceMeters: 110, dispersionMeters: 3 }),
      makeSummary({ clubKey: 'iron-9', distanceMeters: 110, dispersionMeters: 25 })
    ];

    const r = recommendClub({
      summaries: clubs,
      shotsByClub: new Map([
        ['iron-7', goodShots],
        ['iron-9', badShots]
      ]),
      geometry: geom,
      playerPosition: player
    });
    expect(r?.clubKey).toBe('iron-7');
    expect(r?.reason).toBe('reaches_best_green_hit');
  });
});
