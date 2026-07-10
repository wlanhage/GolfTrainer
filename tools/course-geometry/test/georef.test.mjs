import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGeorefFromCenter, makeGeorefFromBounds, pixelsToPolygon, parseMarks } from '../lib/georef.mjs';
import { lngLatToWorldPixel } from '../lib/geo.mjs';

const FALSTERBO = { lat: 55.395, lng: 12.848 };

test('makeGeorefFromCenter: tile-aligned origin, grid-sized, contains the center', () => {
  const g = makeGeorefFromCenter(FALSTERBO, 19, 3);
  assert.equal(g.zoom, 19);
  assert.equal(g.originX % 256, 0);
  assert.equal(g.originY % 256, 0);
  assert.equal(g.widthPx, 3 * 256);
  assert.equal(g.heightPx, 3 * 256);
  const c = lngLatToWorldPixel(FALSTERBO, 19);
  assert.ok(c.x >= g.originX && c.x <= g.originX + g.widthPx);
  assert.ok(c.y >= g.originY && c.y <= g.originY + g.heightPx);
  assert.throws(() => makeGeorefFromCenter({ lat: 55.4, lng: 12.85 }, 19, 1), /grid/);
});

test('makeGeorefFromBounds: fits a course bbox at high zoom, tile-aligned', () => {
  const g = makeGeorefFromBounds(
    { minLat: 55.39, minLng: 12.84, maxLat: 55.40, maxLng: 12.86 },
    2560
  );
  assert.ok(g.zoom >= 14 && g.zoom <= 19, `zoom ${g.zoom}`);
  assert.equal(g.originX % 256, 0);
  assert.ok(g.widthPx <= 2560 + 256 && g.heightPx <= 2560 + 256);
  const nw = lngLatToWorldPixel({ lat: 55.40, lng: 12.84 }, g.zoom);
  const se = lngLatToWorldPixel({ lat: 55.39, lng: 12.86 }, g.zoom);
  assert.ok(nw.x >= g.originX && se.x <= g.originX + g.widthPx);
  assert.ok(nw.y >= g.originY && se.y <= g.originY + g.heightPx);
});

test('makeGeorefFromBounds: throws when bounds cannot fit', () => {
  assert.throws(() =>
    makeGeorefFromBounds({ minLat: 55, minLng: 11, maxLat: 69, maxLng: 24 }, 2560)
  );
});

test('pixelsToPolygon round-trips lngLatToWorldPixel', () => {
  const g = makeGeorefFromCenter(FALSTERBO, 19, 3);
  const w = lngLatToWorldPixel(FALSTERBO, 19);
  const px = `${(w.x - g.originX).toFixed(2)},${(w.y - g.originY).toFixed(2)}`;
  const poly = pixelsToPolygon(g, `${px} 100,100 200,150`);
  assert.equal(poly.length, 3);
  assert.ok(Math.abs(poly[0].lat - FALSTERBO.lat) < 1e-6);
  assert.ok(Math.abs(poly[0].lng - FALSTERBO.lng) < 1e-6);
});

test('pixelsToPolygon rejects malformed input', () => {
  const g = makeGeorefFromCenter(FALSTERBO, 19, 3);
  assert.throws(() => pixelsToPolygon(g, '10,10 20,20'), /at least 3/);
  assert.throws(() => pixelsToPolygon(g, '10,10 20,20 nope'), /bad point/);
  assert.throws(() => pixelsToPolygon(g, '   '), /got 0/);
});

test('parseMarks parses labels and rejects garbage', () => {
  assert.deepEqual(parseMarks('A:10,20 B:30.5,40'), [
    { label: 'A', x: 10, y: 20 },
    { label: 'B', x: 30.5, y: 40 }
  ]);
  assert.throws(() => parseMarks('A-10,20'), /bad mark/);
});
