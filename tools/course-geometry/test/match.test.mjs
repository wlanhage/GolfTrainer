import test from 'node:test';
import assert from 'node:assert/strict';
import { matchGreens, validateGreen, pickTee } from '../lib/match.mjs';

const M = 1 / 111_195; // degrees latitude per metre
const squareGreen = (id, lat, lng, side = 30) => {
  const h = (side / 2) * M;
  const w = ((side / 2) * M) / Math.cos((lat * Math.PI) / 180);
  return {
    id,
    points: [
      { lat: lat - h, lng: lng - w }, { lat: lat - h, lng: lng + w },
      { lat: lat + h, lng: lng + w }, { lat: lat + h, lng: lng - w }
    ]
  };
};
const holeWay = (ref, fromLat, toLat) => ({
  ref,
  points: [{ lat: fromLat, lng: 12 }, { lat: toLat, lng: 12 }]
});

test('validateGreen accepts a 30 m square (~900 m²), rejects a 5 m square', () => {
  assert.equal(validateGreen(squareGreen('a', 56, 12).points).ok, true);
  const small = validateGreen(squareGreen('b', 56, 12, 5).points);
  assert.equal(small.ok, false);
  assert.ok(small.reasons[0].includes('area'));
});

test('matches the green nearest the hole way end point', () => {
  const greens = [squareGreen('near', 56.0022, 12), squareGreen('far', 56.01, 12)];
  const [r] = matchGreens({ holes: [holeWay('1', 56, 56.002)], greens, holeCount: 1 });
  assert.equal(r.status, 'matched');
  assert.equal(r.greenId, 'near');
  assert.equal(r.reversedWay, false);
  assert.ok(r.polygon.length === 4);
});

test('falls back to the way start for reversed ways and flags it', () => {
  const greens = [squareGreen('g', 56.0022, 12)];
  const [r] = matchGreens({ holes: [holeWay('1', 56.002, 56)], greens, holeCount: 1 });
  assert.equal(r.status, 'matched');
  assert.equal(r.reversedWay, true);
});

test('matchGreens picks the green end on a reversed (green->tee) hole way', () => {
  const rightGreen = squareGreen('right', 56.000, 12);      // near the way's FIRST point
  const wrongGreen = squareGreen('wrong', 56.0025, 12);     // near the way's LAST point (the tee end)
  // way digitised green(56.0)->tee(56.0025+): last point ~50 m from wrongGreen, first point ~0 m from rightGreen
  const way = { ref: '1', points: [{ lat: 56.0, lng: 12 }, { lat: 56.0025 + 50 * M, lng: 12 }] };
  const [r] = matchGreens({ holes: [way], greens: [rightGreen, wrongGreen], holeCount: 1 });
  assert.equal(r.status, 'matched');
  assert.equal(r.greenId, 'right');
  assert.equal(r.reversedWay, true);
});

test('reports unmatched when no green is within 80 m', () => {
  const greens = [squareGreen('g', 56.005, 12)]; // ≈330 m from the way end
  const [r] = matchGreens({ holes: [holeWay('1', 56, 56.002)], greens, holeCount: 1 });
  assert.equal(r.status, 'unmatched');
});

test('ignores degenerate greens with fewer than 3 points', () => {
  const greens = [{ id: 'broken', points: [{ lat: 56.002, lng: 12 }, { lat: 56.0021, lng: 12 }] }];
  const [r] = matchGreens({ holes: [holeWay('1', 56, 56.002)], greens, holeCount: 1 });
  assert.equal(r.status, 'unmatched');
});

test('flags ambiguity when two greens are nearly equidistant', () => {
  const greens = [squareGreen('a', 56.0023, 12), squareGreen('b', 56.0024, 12)];
  const [r] = matchGreens({ holes: [holeWay('1', 56, 56.002)], greens, holeCount: 1 });
  assert.equal(r.status, 'ambiguous');
});

test('reports missing hole ways and duplicate refs', () => {
  assert.equal(matchGreens({ holes: [], greens: [], holeCount: 1 })[0].status, 'no-hole-way');
  const dup = matchGreens({
    holes: [holeWay('1', 56, 56.002), holeWay('1', 57, 57.002)],
    greens: [],
    holeCount: 1
  });
  assert.equal(dup[0].status, 'duplicate-hole-ways');
});

test('downgrades to ambiguous when two holes claim the same green', () => {
  const greens = [squareGreen('shared', 56.002, 12)];
  const res = matchGreens({
    holes: [holeWay('1', 56, 56.0021), holeWay('2', 56.004, 56.0022)],
    greens,
    holeCount: 2
  });
  assert.equal(res[0].status, 'ambiguous');
  assert.equal(res[0].reason, 'shared-green');
  assert.equal(res[1].status, 'ambiguous');
});

test('80 m cap boundary: ~75 m matches, ~85 m does not', () => {
  const near = matchGreens({
    holes: [holeWay('1', 56, 56.002)],
    greens: [squareGreen('g', 56.002 + 75 * M, 12)],
    holeCount: 1
  });
  assert.equal(near[0].status, 'matched');
  const far = matchGreens({
    holes: [holeWay('1', 56, 56.002)],
    greens: [squareGreen('g', 56.002 + 85 * M, 12)],
    holeCount: 1
  });
  assert.equal(far[0].status, 'unmatched');
});

test('validateGreen returns the normalized (open) ring', () => {
  const open = squareGreen('a', 56, 12).points;
  const closed = [...open, { ...open[0] }];
  const v = validateGreen(closed);
  assert.equal(v.ok, true);
  assert.equal(v.ring.length, 4);
  assert.deepEqual(v.ring, open);
});

test('ambiguous results carry the runner-up green', () => {
  const greens = [squareGreen('a', 56.0023, 12), squareGreen('b', 56.0024, 12)];
  const [r] = matchGreens({ holes: [holeWay('1', 56, 56.002)], greens, holeCount: 1 });
  assert.equal(r.status, 'ambiguous');
  assert.equal(r.secondGreenId, 'b');
  assert.equal(r.secondDistanceM, 44);
});

test('validateGreen rejects non-numeric coordinates and non-arrays', () => {
  const v = validateGreen([{ lat: '56', lng: 12 }, { lat: 56.001, lng: 12 }, { lat: 56.001, lng: 12.001 }]);
  assert.equal(v.ok, false);
  assert.ok(v.reasons[0].includes('non-numeric'));
  assert.equal(validateGreen({}).ok, false);
});

test('unmatched holes carry a lookAt target (the way end point)', () => {
  const [r] = matchGreens({ holes: [holeWay('1', 56, 56.002)], greens: [], holeCount: 1 });
  assert.equal(r.status, 'unmatched');
  assert.deepEqual(r.lookAt, { lat: 56.002, lng: 12 });
});

const teeAt = (id, lat, lng) => ({ id, point: { lat, lng }, ref: null, name: null });

test('pickTee picks the tee whose distance best matches the scorecard length', () => {
  const greenCenter = { lat: 56, lng: 12 };
  const tees = [
    teeAt('t-back', 56 + 380 * M, 12),   // 380 m
    teeAt('t-mid', 56 + 350 * M, 12),    // 350 m
    teeAt('t-front', 56 + 300 * M, 12)   // 300 m
  ];
  const r = pickTee({ tees, greenCenter, holeLengthM: 355 });
  assert.equal(r.teeId, 't-mid');
  assert.ok(Math.abs(r.distanceM - 350) <= 1);
});

test('pickTee band: rejects tees shorter than 75% or longer than 105% of the length', () => {
  const greenCenter = { lat: 56, lng: 12 };
  assert.equal(pickTee({ tees: [teeAt('a', 56 + 250 * M, 12)], greenCenter, holeLengthM: 400 }), null); // 62%
  assert.equal(pickTee({ tees: [teeAt('b', 56 + 440 * M, 12)], greenCenter, holeLengthM: 400 }), null); // 110%
});

test('pickTee refuses near-ties between far-apart tees, allows adjacent pads', () => {
  const greenCenter = { lat: 56, lng: 12 };
  // Two tees with ~equal length error but 100+ m apart (different holes' tees) → refuse
  const farApart = [
    teeAt('a', 56 + 350 * M, 12),
    teeAt('b', 56, 12 + (352 * M) / Math.cos((56 * Math.PI) / 180))
  ];
  const refused = pickTee({ tees: farApart, greenCenter, holeLengthM: 351 });
  assert.equal(refused.reason, 'ambiguous-tees');
  assert.equal(refused.point, undefined);
  // Two pads 10 m apart (same tee area) → pick the better one, no refusal
  const adjacent = [teeAt('a', 56 + 350 * M, 12), teeAt('b', 56 + 360 * M, 12)];
  assert.equal(pickTee({ tees: adjacent, greenCenter, holeLengthM: 351 }).teeId, 'a');
});

test('pickTee refuses when a far-apart rival hides behind an adjacent pad', () => {
  const greenCenter = { lat: 56, lng: 12 };
  const tees = [
    teeAt('a', 56 + 349 * M, 12),
    teeAt('b', 56 + 352 * M, 12), // adjacent pad ~3 m from a — must not block
    teeAt('c', 56, 12 + (353 * M) / Math.cos((56 * Math.PI) / 180)) // ~500 m away, similar error
  ];
  const r = pickTee({ tees, greenCenter, holeLengthM: 350 });
  assert.equal(r.reason, 'ambiguous-tees');
});

test('pickTee handles missing/invalid input', () => {
  assert.equal(pickTee({ tees: [], greenCenter: { lat: 56, lng: 12 }, holeLengthM: 300 }), null);
  assert.equal(pickTee({ tees: [teeAt('a', 56.003, 12)], greenCenter: { lat: 56, lng: 12 }, holeLengthM: null }), null);
});

test('matchGreens without tees/lengths behaves exactly as before (back-compat)', () => {
  const greens = [squareGreen('g', 56.0022, 12)];
  const [r] = matchGreens({ holes: [holeWay('1', 56, 56.002)], greens, holeCount: 1 });
  assert.equal(r.status, 'matched');
  assert.equal('teePoint' in r, false);
});

test('matchGreens attaches teePoint when tees and lengths are provided', () => {
  const greens = [squareGreen('g', 56.0022, 12)];
  const tees = [teeAt('t', 56.0022 - 350 * M, 12)];
  const [r] = matchGreens({
    holes: [holeWay('1', 56, 56.002)],
    greens,
    holeCount: 1,
    tees,
    holeLengths: { 1: 350 }
  });
  assert.equal(r.status, 'matched');
  assert.equal(r.teeId, 't');
  assert.ok(Math.abs(r.teeDistanceM - 350) <= 1);
  assert.ok(Math.abs(r.teePoint.lat - (56.0022 - 350 * M)) < 1e-9);
});
