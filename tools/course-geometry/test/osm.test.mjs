import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverpassQuery, parseOverpass, buildCourseBoundsQuery, parseCourseBounds } from '../lib/osm.mjs';

test('buildOverpassQuery includes club and optional course name filters', () => {
  const q = buildOverpassQuery({ club: 'Vasatorp', course: 'TC' });
  assert.ok(q.includes('["name"~"Vasatorp",i]["name"~"TC",i]'), q);
  assert.ok(q.includes('["golf"="green"]'));
  assert.ok(q.includes('["golf"="hole"]'));
  assert.ok(q.includes('["golf"="tee"]'));
  assert.ok(q.includes('node(area.c)["golf"="tee"]'));
  const noCourse = buildOverpassQuery({ club: 'Rya' });
  assert.ok(noCourse.includes('["name"~"Rya",i];') || noCourse.includes('["name"~"Rya",i]\n'), noCourse);
});

test('parseOverpass splits course areas, holes and greens; drops closing vertex', () => {
  const json = {
    elements: [
      { type: 'way', id: 1, tags: { leisure: 'golf_course', name: 'Test GK' } },
      {
        type: 'way', id: 2, tags: { golf: 'hole', ref: '1' },
        geometry: [{ lat: 56, lon: 12 }, { lat: 56.002, lon: 12 }]
      },
      {
        type: 'way', id: 3, tags: { golf: 'green' },
        geometry: [
          { lat: 56, lon: 12 }, { lat: 56, lon: 12.0002 },
          { lat: 56.0001, lon: 12.0002 }, { lat: 56, lon: 12 }
        ]
      }
    ]
  };
  const parsed = parseOverpass(json);
  assert.deepEqual(parsed.courseNames, ['Test GK']);
  assert.equal(parsed.holes.length, 1);
  assert.equal(parsed.holes[0].ref, '1');
  assert.equal(parsed.holes[0].points[1].lat, 56.002);
  assert.equal(parsed.holes[0].points[1].lng, 12);
  assert.equal(parsed.greens.length, 1);
  assert.equal(parsed.greens[0].id, 'way/3');
  assert.equal(parsed.greens[0].points.length, 3);
});

test('buildCourseBoundsQuery asks for tags and bounds only', () => {
  const q = buildCourseBoundsQuery({ club: 'Hofgård' });
  assert.ok(q.includes('["name"~"Hofgård",i]'));
  assert.ok(q.includes('out tags bb;'));
  assert.ok(!q.includes('golf"="hole'));
});

test('parseCourseBounds maps Overpass bounds to lat/lng bounds', () => {
  const json = {
    elements: [
      {
        type: 'way', id: 9, tags: { leisure: 'golf_course', name: 'Test GK' },
        bounds: { minlat: 55.1, minlon: 12.1, maxlat: 55.2, maxlon: 12.3 }
      },
      { type: 'way', id: 10, tags: { leisure: 'golf_course' } } // no bounds → skipped
    ]
  };
  const parsed = parseCourseBounds(json);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'Test GK');
  assert.deepEqual(parsed[0].bounds, { minLat: 55.1, minLng: 12.1, maxLat: 55.2, maxLng: 12.3 });
});

test('parseOverpass extracts tees from ways (centroid) and nodes', () => {
  const json = {
    elements: [
      {
        type: 'way', id: 20, tags: { golf: 'tee', ref: '58' },
        geometry: [
          { lat: 56, lon: 12 }, { lat: 56, lon: 12.0002 },
          { lat: 56.0002, lon: 12.0002 }, { lat: 56.0002, lon: 12 }, { lat: 56, lon: 12 }
        ]
      },
      { type: 'node', id: 21, lat: 56.001, lon: 12.001, tags: { golf: 'tee', name: 'Gul 7' } },
      { type: 'way', id: 22, tags: { golf: 'tee' } } // no geometry → skipped
    ]
  };
  const parsed = parseOverpass(json);
  assert.equal(parsed.tees.length, 2);
  assert.equal(parsed.tees[0].id, 'way/20');
  assert.equal(parsed.tees[0].ref, '58');
  assert.ok(Math.abs(parsed.tees[0].point.lat - 56.0001) < 1e-9);
  assert.ok(Math.abs(parsed.tees[0].point.lng - 12.0001) < 1e-9);
  assert.deepEqual(parsed.tees[1], { id: 'node/21', point: { lat: 56.001, lng: 12.001 }, ref: null, name: 'Gul 7' });
});
