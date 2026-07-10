import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineMeters, normalizeRing, centroid, polygonAreaM2,
  lngLatToWorldPixel, worldPixelToLngLat
} from '../lib/geo.mjs';

test('haversineMeters: 0.001° latitude ≈ 111 m', () => {
  const d = haversineMeters({ lat: 56, lng: 12 }, { lat: 56.001, lng: 12 });
  assert.ok(Math.abs(d - 111.2) < 1, `got ${d}`);
});

test('normalizeRing drops a duplicated closing vertex, keeps open rings as-is', () => {
  const closed = [{ lat: 1, lng: 1 }, { lat: 1, lng: 2 }, { lat: 2, lng: 2 }, { lat: 1, lng: 1 }];
  assert.equal(normalizeRing(closed).length, 3);
  assert.equal(normalizeRing(closed.slice(0, 3)).length, 3);
});

test('centroid averages the vertices', () => {
  const c = centroid([{ lat: 0, lng: 0 }, { lat: 2, lng: 4 }]);
  assert.deepEqual(c, { lat: 1, lng: 2 });
});

test('polygonAreaM2: ~30×20 m rectangle at lat 56 ≈ 600 m²', () => {
  const dLat = 20 / 111_195;
  const dLng = 30 / (111_195 * Math.cos((56 * Math.PI) / 180));
  const rect = [
    { lat: 56, lng: 12 }, { lat: 56, lng: 12 + dLng },
    { lat: 56 + dLat, lng: 12 + dLng }, { lat: 56 + dLat, lng: 12 }
  ];
  const area = polygonAreaM2(rect);
  assert.ok(Math.abs(area - 600) < 6, `got ${area}`);
});

test('lngLatToWorldPixel: lat/lng 0,0 maps to the centre of the z0 world', () => {
  const { x, y } = lngLatToWorldPixel({ lat: 0, lng: 0 }, 0);
  assert.ok(Math.abs(x - 128) < 1e-6 && Math.abs(y - 128) < 1e-6);
});

test('worldPixelToLngLat round-trips lngLatToWorldPixel', () => {
  const p = { lat: 56.123456, lng: 12.654321 };
  const back = worldPixelToLngLat(lngLatToWorldPixel(p, 19), 19);
  assert.ok(Math.abs(back.lat - p.lat) < 1e-9 && Math.abs(back.lng - p.lng) < 1e-9);
});

test('polygonAreaM2 returns 0 for degenerate polygons', () => {
  assert.equal(polygonAreaM2([]), 0);
  assert.equal(polygonAreaM2([{ lat: 56, lng: 12 }, { lat: 56.001, lng: 12 }]), 0);
});
