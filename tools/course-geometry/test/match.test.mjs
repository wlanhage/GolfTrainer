import test from 'node:test';
import assert from 'node:assert/strict';
import { matchGreens, validateGreen } from '../lib/match.mjs';

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
