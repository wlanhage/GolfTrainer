import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverpassQuery, parseOverpass, buildCourseBoundsQuery, parseCourseBounds } from '../lib/osm.mjs';

test('buildOverpassQuery includes club and optional course name filters', () => {
  const q = buildOverpassQuery({ club: 'Vasatorp', course: 'TC' });
  assert.ok(q.includes('["name"~"Vasatorp",i]["name"~"TC",i]'), q);
  assert.ok(q.includes('["golf"="green"]'));
  assert.ok(q.includes('["golf"="hole"]'));
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
