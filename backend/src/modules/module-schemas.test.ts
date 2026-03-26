import assert from 'node:assert/strict';
import test from 'node:test';
import { createClubSchema, updateClubSchema } from './clubs/clubs.schema.js';
import { createCourseSchema, updateHoleLayoutSchema } from './courses/courses.schema.js';
import { createDrillAttemptSchema } from './drill-attempts/drillAttempts.schema.js';
import { createDrillSchema } from './drills/drills.schema.js';
import { createSessionSchema } from './practice-sessions/practiceSessions.schema.js';
import { createShotSchema } from './shots/shots.schema.js';
import { rangeQuerySchema, trendQuerySchema } from './stats/stats.schema.js';
import { updateMeSchema } from './users/users.schema.js';

test('club schema requires at least one update field', () => {
  assert.equal(createClubSchema.safeParse({ label: 'PW' }).success, true);
  assert.equal(updateClubSchema.safeParse({}).success, false);
});

test('drill attempt schema enforces successfulAttempts <= totalAttempts', () => {
  const parsed = createDrillAttemptSchema.safeParse({
    drillId: 'cmf81q7q90001pbw0v4lq8caa',
    successfulAttempts: 5,
    totalAttempts: 4
  });

  assert.equal(parsed.success, false);
});

test('drill, session and shot schemas accept valid payloads', () => {
  assert.equal(createDrillSchema.safeParse({ name: 'Chip ladder', metricType: 'SUCCESS_RATE' }).success, true);
  assert.equal(createSessionSchema.safeParse({ startedAt: '2025-01-01T00:00:00.000Z' }).success, true);
  assert.equal(createShotSchema.safeParse({
    userClubId: 'cmf81q7q90001pbw0v4lq8cab',
    recordedAt: '2025-01-01T00:00:00.000Z'
  }).success, true);
});

test('stats query defaults are applied', () => {
  assert.equal(rangeQuerySchema.parse({}).rangeDays, 30);
  assert.equal(trendQuerySchema.parse({}).rangeDays, 30);
});

test('user update schema rejects empty payload', () => {
  assert.equal(updateMeSchema.safeParse({}).success, false);
  assert.equal(updateMeSchema.safeParse({ displayName: 'Player' }).success, true);
});


test('course schemas accept valid course + layout payloads', () => {
  assert.equal(createCourseSchema.safeParse({ clubName: 'Club', courseName: 'Course', teeName: 'White', holeCount: 18 }).success, true);
  assert.equal(updateHoleLayoutSchema.safeParse({
    geometry: {
      teePoint: { lat: 59.33, lng: 18.06 },
      greenPolygon: [{ lat: 59.33, lng: 18.07 }, { lat: 59.34, lng: 18.07 }, { lat: 59.34, lng: 18.06 }],
      fairwayPolygon: [],
      bunkerPolygons: [],
      treesPolygons: [],
      obPolygons: []
    }
  }).success, true);
});
