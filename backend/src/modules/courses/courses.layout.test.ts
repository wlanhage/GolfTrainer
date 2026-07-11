import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLayoutWrite } from './courses.service.js';

const square = [
  { lat: 56, lng: 12 }, { lat: 56, lng: 12.0002 },
  { lat: 56.0001, lng: 12.0002 }, { lat: 56.0001, lng: 12 }
];

test('buildLayoutWrite: green only → status PARTIAL, no bearing/length', () => {
  const w = buildLayoutWrite({
    teePoint: null, greenPolygon: square, fairwayPolygons: [],
    bunkerPolygons: [], treesPolygons: [], obPolygons: []
  });
  assert.equal(w.greenPolygon, square);
  assert.equal(w.holeBearing, null);
  assert.equal(w.holeLengthMeters, null);
  assert.deepEqual(w.teeToGreenCenterline, []);
});

test('buildLayoutWrite: tee + green → derived length/bearing populated', () => {
  const w = buildLayoutWrite({
    teePoint: { lat: 55.997, lng: 12.0001 }, greenPolygon: square, fairwayPolygons: [],
    bunkerPolygons: [], treesPolygons: [], obPolygons: []
  });
  assert.ok(Number(w.holeLengthMeters) > 200 && Number(w.holeLengthMeters) < 400);
  assert.ok(w.teeToGreenCenterline.length === 2);
});
