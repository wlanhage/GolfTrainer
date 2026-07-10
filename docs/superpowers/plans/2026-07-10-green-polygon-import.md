# Green Polygon Import Implementation Plan

> **Status: EXECUTED** (2026-07-10, branch `feat/green-polygon-import`). Do not
> re-execute. Several details were superseded by review during execution —
> trust the final code and `tools/course-geometry/README.md` over this
> document (test script is bare `node --test`; Overpass mirror list refreshed;
> the PATCH sends `validateGreen`'s normalized ring, not the raw polygon;
> extra hardening throughout).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A zero-dependency Node CLI in `tools/course-geometry/` that fetches `golf=green` polygons from OpenStreetMap, matches them to hole numbers, and imports them merge-safely via the existing `PATCH /api/v1/courses/:id/holes/:holeNumber/layout` endpoint, plus per-hole preview PNGs for visual review.

**Architecture:** Three small pure libs (`geo`, `osm`, `match`) unit-tested with `node --test`, a thin API client, and two CLIs (`import-greens.mjs`, `preview.mjs`). Preview rendering borrows the Playwright install from `tools/pr-screenshots/`. No backend changes.

**Tech Stack:** Node ≥ 20 (built-in `fetch`, `node:test`), Overpass API, Esri World Imagery tiles, Playwright (existing install only).

**Spec:** `docs/superpowers/specs/2026-07-10-green-polygon-import-design.md`

**Key backend facts (verified 2026-07-10):**
- `POST /api/v1/auth/login` `{ email, password }` → `{ accessToken, refreshToken }`.
- `GET /api/v1/courses/:id` → `{ ..., holeCount, holes: [{ holeNumber, layout: { geometry: { teePoint, greenPolygon, fairwayPolygon, fairwayPolygons, bunkerPolygons, treesPolygons, obPolygons } } }] }`.
- `PATCH /api/v1/courses/:id/holes/:holeNumber/layout` (admin) body `{ geometry }`; `teePoint` (nullable), `greenPolygon`, `bunkerPolygons`, `treesPolygons`, `obPolygons` are **required** keys; the PATCH replaces the whole geometry and the server recomputes derived fields (`backend/src/modules/courses/courses.service.ts#updateHoleLayout`).
- Ring convention: **open ring** (no repeated first vertex). `resolveGreenCenter` averages *every* vertex (`courses.service.ts:63`), so a closed ring would bias the green center. OSM closed ways repeat the first node — the converter must drop it.
- Local stack: Postgres container `golftrainer-db` (port 5433), `npm --prefix backend run dev:local` (:3000), seeded admin `admin@golf.test` / `Admin123!`.

---

### Task 1: Scaffold + geo helpers (`lib/geo.mjs`)

**Files:**
- Create: `tools/course-geometry/package.json`
- Create: `tools/course-geometry/lib/geo.mjs`
- Test: `tools/course-geometry/test/geo.test.mjs`

- [ ] **Step 1: Create the package scaffold**

`tools/course-geometry/package.json`:

```json
{
  "name": "course-geometry",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "Import green polygons for a course from OpenStreetMap.",
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 2: Write the failing tests**

`tools/course-geometry/test/geo.test.mjs`:

```js
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd tools/course-geometry && npm test`
Expected: FAIL — `Cannot find module '../lib/geo.mjs'`

- [ ] **Step 4: Implement `lib/geo.mjs`**

```js
// Pure geo helpers. Points are {lat, lng}, matching the backend schema.
const R = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

export function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// The app stores open rings: the backend averages every vertex for the green
// center, so OSM's duplicated closing vertex must be dropped.
export function normalizeRing(points) {
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) return points.slice(0, -1);
  }
  return points;
}

export function centroid(points) {
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

// Shoelace on an equirectangular projection centred on the polygon.
// Error is negligible at green scale (< 100 m across).
export function polygonAreaM2(points) {
  const ring = normalizeRing(points);
  if (ring.length < 3) return 0;
  const lat0 = toRad(centroid(ring).lat);
  const pts = ring.map((p) => ({ x: toRad(p.lng) * R * Math.cos(lat0), y: toRad(p.lat) * R }));
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

// Web Mercator world pixel at zoom z (256 px tiles).
export function lngLatToWorldPixel({ lat, lng }, z) {
  const size = 256 * 2 ** z;
  const x = ((lng + 180) / 360) * size;
  const latR = toRad(lat);
  const y = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * size;
  return { x, y };
}

export function worldPixelToLngLat({ x, y }, z) {
  const size = 256 * 2 ** z;
  const lng = (x / size) * 360 - 180;
  const n = Math.PI * (1 - 2 * (y / size));
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd tools/course-geometry && npm test`
Expected: 6 passing

- [ ] **Step 6: Commit**

```bash
git add tools/course-geometry/package.json tools/course-geometry/lib/geo.mjs tools/course-geometry/test/geo.test.mjs
git commit -m "feat(tools): course-geometry geo helpers"
```

---

### Task 2: Overpass fetch + parse (`lib/osm.mjs`)

**Files:**
- Create: `tools/course-geometry/lib/osm.mjs`
- Test: `tools/course-geometry/test/osm.test.mjs`

- [ ] **Step 1: Write the failing tests**

`tools/course-geometry/test/osm.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverpassQuery, parseOverpass } from '../lib/osm.mjs';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/course-geometry && npm test`
Expected: FAIL — `Cannot find module '../lib/osm.mjs'` (geo tests still pass)

- [ ] **Step 3: Implement `lib/osm.mjs`**

```js
import { normalizeRing } from './geo.mjs';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

// --club / --course are used as case-insensitive Overpass regexes; escape
// only quotes and backslashes so simple names work verbatim.
const esc = (s) => s.replace(/["\\]/g, '\\$&');

export function buildOverpassQuery({ club, course }) {
  const nameFilters =
    `["name"~"${esc(club)}",i]` + (course ? `["name"~"${esc(course)}",i]` : '');
  return `[out:json][timeout:60];
area["ISO3166-1"="SE"][admin_level=2]->.se;
(
  way(area.se)["leisure"="golf_course"]${nameFilters};
  relation(area.se)["leisure"="golf_course"]${nameFilters};
)->.gc;
.gc map_to_area ->.c;
(
  way(area.c)["golf"="hole"];
  way(area.c)["golf"="green"];
);
out geom;
.gc out tags;`;
}

// → { courseNames: string[], holes: [{ref, points}], greens: [{id, points}] }
export function parseOverpass(json) {
  const courseNames = [];
  const holes = [];
  const greens = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    if (tags.leisure === 'golf_course') {
      courseNames.push(tags.name ?? `${el.type}/${el.id}`);
      continue;
    }
    const points = (el.geometry ?? []).map((g) => ({ lat: g.lat, lng: g.lon }));
    if (tags.golf === 'hole') holes.push({ ref: tags.ref ?? null, points });
    else if (tags.golf === 'green')
      greens.push({ id: `${el.type}/${el.id}`, points: normalizeRing(points) });
  }
  return { courseNames, holes, greens };
}

export async function fetchOverpass(query) {
  let lastErr;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      console.error(`Overpass attempt failed (${url}): ${err.message}`);
    }
  }
  throw new Error(`All Overpass endpoints failed. Last error: ${lastErr.message}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/course-geometry && npm test`
Expected: 8 passing

- [ ] **Step 5: Commit**

```bash
git add tools/course-geometry/lib/osm.mjs tools/course-geometry/test/osm.test.mjs
git commit -m "feat(tools): overpass fetch and parse for course greens"
```

---

### Task 3: Match greens to holes (`lib/match.mjs`)

**Files:**
- Create: `tools/course-geometry/lib/match.mjs`
- Test: `tools/course-geometry/test/match.test.mjs`

Matching rule (from spec): the OSM convention draws `golf=hole` ways tee→green, so the green is the polygon whose centroid is nearest the way's **last** point, within 80 m. If nothing matches, try the **first** point (reversed way, flagged). If the second-nearest green is also within 80 m and less than 20 m further away, flag as ambiguous — never pick silently.

- [ ] **Step 1: Write the failing tests**

`tools/course-geometry/test/match.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/course-geometry && npm test`
Expected: FAIL — `Cannot find module '../lib/match.mjs'`

- [ ] **Step 3: Implement `lib/match.mjs`**

```js
import { haversineMeters, centroid, polygonAreaM2, normalizeRing } from './geo.mjs';

export const MAX_GREEN_DISTANCE_M = 80;
export const AMBIGUITY_MARGIN_M = 20;
export const MIN_AREA_M2 = 150;
export const MAX_AREA_M2 = 1500;

export function validateGreen(points) {
  const ring = normalizeRing(points);
  const area = Math.round(polygonAreaM2(ring));
  const reasons = [];
  if (ring.length < 3) reasons.push(`only ${ring.length} vertices`);
  if (area < MIN_AREA_M2 || area > MAX_AREA_M2)
    reasons.push(`area ${area} m² outside ${MIN_AREA_M2}-${MAX_AREA_M2} m²`);
  return { ok: reasons.length === 0, area, reasons };
}

// One result per hole number 1..holeCount. Statuses:
//   matched | ambiguous | unmatched | no-hole-way | duplicate-hole-ways
export function matchGreens({ holes, greens, holeCount }) {
  const results = [];
  for (let n = 1; n <= holeCount; n++) {
    const candidates = holes.filter((h) => Number(h.ref) === n && h.points.length >= 2);
    if (candidates.length === 0) {
      results.push({ holeNumber: n, status: 'no-hole-way' });
      continue;
    }
    if (candidates.length > 1) {
      results.push({ holeNumber: n, status: 'duplicate-hole-ways', count: candidates.length });
      continue;
    }
    const way = candidates[0];
    const attempt = (endpoint) => {
      const ranked = greens
        .map((g) => ({ g, d: haversineMeters(endpoint, centroid(g.points)) }))
        .sort((a, b) => a.d - b.d);
      const best = ranked[0];
      if (!best || best.d > MAX_GREEN_DISTANCE_M) return null;
      const second = ranked[1];
      const ambiguous =
        second && second.d <= MAX_GREEN_DISTANCE_M && second.d - best.d < AMBIGUITY_MARGIN_M;
      return { green: best.g, distance: Math.round(best.d), ambiguous };
    };
    const fwd = attempt(way.points[way.points.length - 1]);
    const rev = fwd ? null : attempt(way.points[0]);
    const hit = fwd ?? rev;
    if (!hit) {
      results.push({ holeNumber: n, status: 'unmatched' });
      continue;
    }
    results.push({
      holeNumber: n,
      status: hit.ambiguous ? 'ambiguous' : 'matched',
      reversedWay: Boolean(rev),
      greenId: hit.green.id,
      distanceM: hit.distance,
      polygon: hit.green.points
    });
  }
  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/course-geometry && npm test`
Expected: 14 passing

- [ ] **Step 5: Commit**

```bash
git add tools/course-geometry/lib/match.mjs tools/course-geometry/test/match.test.mjs
git commit -m "feat(tools): match OSM greens to hole numbers"
```

---

### Task 4: API client + import CLI

**Files:**
- Create: `tools/course-geometry/lib/api.mjs`
- Create: `tools/course-geometry/import-greens.mjs`

The API client and CLI are thin orchestration over the tested libs — they are integration-tested against the local stack in Task 8, not unit-tested.

- [ ] **Step 1: Implement `lib/api.mjs`**

```js
// Thin client for the GolfTrainer backend. All paths are /api/v1.
export function createApi(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  let token = null;

  const call = async (method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      throw new Error(`${method} ${path} -> HTTP ${res.status}: ${await res.text()}`);
    }
    return res.status === 204 ? null : res.json();
  };

  return {
    async login(email, password) {
      const result = await call('POST', '/api/v1/auth/login', { email, password });
      token = result.accessToken;
    },
    getCourse: (id) => call('GET', `/api/v1/courses/${id}`),
    patchHoleLayout: (courseId, holeNumber, geometry) =>
      call('PATCH', `/api/v1/courses/${courseId}/holes/${holeNumber}/layout`, { geometry })
  };
}
```

- [ ] **Step 2: Implement `import-greens.mjs`**

```js
#!/usr/bin/env node
// Import green polygons for an existing course from OpenStreetMap.
//
// Usage:
//   node import-greens.mjs --course-id <cuid> --club "Vasatorp" [--course "TC"]
//     [--api-base http://localhost:3000] [--email ...] [--password ...]
//     [--dry-run] [--force] [--from-json greens.<id>.json]
//
// Writes greens.<courseId>.json (match results) so unresolved holes can be
// hand-edited and re-imported with --from-json. Exit codes: 0 all holes
// resolved, 1 fatal error, 2 completed with unresolved holes.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildOverpassQuery, parseOverpass, fetchOverpass } from './lib/osm.mjs';
import { matchGreens, validateGreen } from './lib/match.mjs';
import { createApi } from './lib/api.mjs';

function parseArgs(argv) {
  const args = {
    apiBase: process.env.GT_API_BASE ?? 'http://localhost:3000',
    email: process.env.GT_ADMIN_EMAIL ?? 'admin@golf.test',
    password: process.env.GT_ADMIN_PASSWORD ?? 'Admin123!',
    dryRun: false,
    force: false,
    fromJson: null
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--course-id') args.courseId = argv[++i];
    else if (a === '--club') args.club = argv[++i];
    else if (a === '--course') args.course = argv[++i];
    else if (a === '--api-base') args.apiBase = argv[++i];
    else if (a === '--email') args.email = argv[++i];
    else if (a === '--password') args.password = argv[++i];
    else if (a === '--from-json') args.fromJson = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.courseId) throw new Error('Missing --course-id');
  if (!args.club && !args.fromJson) throw new Error('Missing --club (or --from-json)');
  return args;
}

const args = parseArgs(process.argv);
const api = createApi(args.apiBase);
await api.login(args.email, args.password);
const course = await api.getCourse(args.courseId);
console.log(`Course: ${course.clubName} / ${course.courseName} (${course.holeCount} holes)`);

let entries;
if (args.fromJson) {
  entries = JSON.parse(readFileSync(args.fromJson, 'utf8')).holes;
} else {
  const osm = parseOverpass(await fetchOverpass(buildOverpassQuery(args)));
  console.log(
    `OSM: ${osm.courseNames.length} course polygon(s), ${osm.holes.length} hole way(s), ${osm.greens.length} green(s)`
  );
  if (osm.greens.length === 0) {
    console.error(
      `No golf=green found for "${args.club}". Candidate course polygons: ${
        osm.courseNames.join(' | ') || 'none'
      }`
    );
    process.exit(1);
  }
  const refs = osm.holes.map((h) => h.ref).filter(Boolean);
  const dupes = [...new Set(refs.filter((r, i) => refs.indexOf(r) !== i))];
  if (dupes.length > 0 && !args.course) {
    console.error(
      `Duplicate hole refs (${dupes.join(', ')}) — several courses matched: ${osm.courseNames.join(
        ' | '
      )}. Narrow the search with --course.`
    );
    process.exit(1);
  }
  entries = matchGreens({ holes: osm.holes, greens: osm.greens, holeCount: course.holeCount });
  const jsonPath = `greens.${args.courseId}.json`;
  writeFileSync(jsonPath, JSON.stringify({ courseId: args.courseId, club: args.club, holes: entries }, null, 2));
  console.log(`Wrote ${jsonPath}`);
}

const report = [];
for (const e of entries) {
  const hole = course.holes.find((h) => h.holeNumber === e.holeNumber);
  if (!hole) {
    report.push({ hole: e.holeNumber, action: 'no-such-hole-in-db' });
    continue;
  }
  if (!e.polygon || e.status !== 'matched') {
    report.push({ hole: e.holeNumber, action: e.status ?? 'unmatched' });
    continue;
  }
  const v = validateGreen(e.polygon);
  if (!v.ok) {
    report.push({ hole: e.holeNumber, action: 'failed-validation', detail: v.reasons.join('; ') });
    continue;
  }
  const existing = hole.layout.geometry;
  if (existing.greenPolygon.length > 0 && !args.force) {
    report.push({ hole: e.holeNumber, action: 'skipped-existing' });
    continue;
  }
  if (args.dryRun) {
    report.push({ hole: e.holeNumber, action: 'would-import', areaM2: v.area, distanceM: e.distanceM });
    continue;
  }
  // Merge-safe: replace ONLY greenPolygon, keep everything else verbatim.
  await api.patchHoleLayout(args.courseId, e.holeNumber, {
    teePoint: existing.teePoint,
    greenPolygon: e.polygon,
    fairwayPolygons: existing.fairwayPolygons ?? [],
    bunkerPolygons: existing.bunkerPolygons ?? [],
    treesPolygons: existing.treesPolygons ?? [],
    obPolygons: existing.obPolygons ?? []
  });
  report.push({ hole: e.holeNumber, action: 'imported', areaM2: v.area, distanceM: e.distanceM });
}

console.table(report);
const unresolved = report.filter(
  (r) => !['imported', 'would-import', 'skipped-existing'].includes(r.action)
);
if (unresolved.length > 0) {
  console.error(`${unresolved.length} hole(s) unresolved — see README for the fallback workflow.`);
  process.exitCode = 2;
}
```

- [ ] **Step 3: Smoke-test arg validation (no backend needed)**

Run: `cd tools/course-geometry && node import-greens.mjs --club "X"`
Expected: throws `Missing --course-id`

Run: `node import-greens.mjs --course-id abc`
Expected: throws `Missing --club (or --from-json)`

- [ ] **Step 4: Commit**

```bash
git add tools/course-geometry/lib/api.mjs tools/course-geometry/import-greens.mjs
git commit -m "feat(tools): import-greens CLI with merge-safe layout PATCH"
```

---

### Task 5: Preview renderer (`preview.mjs`)

**Files:**
- Create: `tools/course-geometry/preview.mjs`

Renders one PNG per hole from a `greens.<courseId>.json`: a static HTML page of absolutely-positioned Esri World Imagery tiles (same source admin-web uses, URL scheme `/tile/{z}/{y}/{x}`) with the polygon as an SVG overlay, screenshotted with the Playwright install from `tools/pr-screenshots/` (run `npm install` there first if `node_modules` is missing).

- [ ] **Step 1: Implement `preview.mjs`**

```js
#!/usr/bin/env node
// Render one PNG per hole: Esri satellite tiles + the green polygon overlay.
//
// Usage: node preview.mjs greens.<courseId>.json [outDir]
//
// Reuses the Playwright install from ../pr-screenshots (npm install there once).
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lngLatToWorldPixel } from './lib/geo.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(new URL('../pr-screenshots/package.json', import.meta.url));
const { chromium } = require('playwright');

const ZOOM = 19;
const TILE = 256;
const MARGIN_PX = 60;

function pageForHole(entry) {
  const px = entry.polygon.map((p) => lngLatToWorldPixel(p, ZOOM));
  const minX = Math.min(...px.map((p) => p.x)) - MARGIN_PX;
  const maxX = Math.max(...px.map((p) => p.x)) + MARGIN_PX;
  const minY = Math.min(...px.map((p) => p.y)) - MARGIN_PX;
  const maxY = Math.max(...px.map((p) => p.y)) + MARGIN_PX;
  const width = Math.ceil(maxX - minX);
  const height = Math.ceil(maxY - minY);
  const imgs = [];
  for (let tx = Math.floor(minX / TILE); tx <= Math.floor(maxX / TILE); tx++) {
    for (let ty = Math.floor(minY / TILE); ty <= Math.floor(maxY / TILE); ty++) {
      imgs.push(
        `<img src="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${ZOOM}/${ty}/${tx}"` +
          ` style="position:absolute;left:${tx * TILE - minX}px;top:${ty * TILE - minY}px;width:${TILE}px;height:${TILE}px">`
      );
    }
  }
  const pts = px.map((p) => `${(p.x - minX).toFixed(1)},${(p.y - minY).toFixed(1)}`).join(' ');
  const label = `Hål ${entry.holeNumber}${entry.status !== 'matched' ? ` (${entry.status})` : ''}`;
  return `<!doctype html><body style="margin:0;position:relative;width:${width}px;height:${height}px;background:#000">
${imgs.join('\n')}
<svg width="${width}" height="${height}" style="position:absolute;left:0;top:0">
  <polygon points="${pts}" fill="rgba(80,220,120,.25)" stroke="#3ddc84" stroke-width="2"/>
  <text x="8" y="22" style="font:bold 15px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px">${label}</text>
</svg></body>`;
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Usage: node preview.mjs greens.<courseId>.json [outDir]');
  process.exit(1);
}
const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
const outDir = process.argv[3] ?? `${here}/out`;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
for (const entry of data.holes.filter((h) => h.polygon)) {
  await page.setContent(pageForHole(entry), { waitUntil: 'networkidle' });
  const file = `${outDir}/hole-${String(entry.holeNumber).padStart(2, '0')}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(file);
}
await browser.close();
const skipped = data.holes.filter((h) => !h.polygon).map((h) => h.holeNumber);
if (skipped.length > 0) console.log(`No polygon (not rendered): holes ${skipped.join(', ')}`);
```

- [ ] **Step 2: Smoke-test with a synthetic JSON**

```bash
cd tools/course-geometry
cat > /tmp/greens.test.json <<'EOF'
{ "courseId": "test", "holes": [ { "holeNumber": 1, "status": "matched", "polygon": [
  { "lat": 55.99973, "lng": 12.99964 }, { "lat": 55.99973, "lng": 13.00036 },
  { "lat": 56.00027, "lng": 13.00036 }, { "lat": 56.00027, "lng": 12.99964 } ] } ] }
EOF
node preview.mjs /tmp/greens.test.json /tmp/preview-out
```

Expected: prints `/tmp/preview-out/hole-01.png`; open the file — satellite imagery with a green translucent polygon and the label "Hål 1".

- [ ] **Step 3: Commit**

```bash
git add tools/course-geometry/preview.mjs
git commit -m "feat(tools): per-hole green preview renderer"
```

---

### Task 6: ODbL attribution on the satellite map styles

**Files:**
- Modify: `webbapp/src/lib/mapStyle.ts:19`
- Modify: `admin-web/src/components/HoleManager.tsx:61`

- [ ] **Step 1: Update webbapp satellite attribution**

In `webbapp/src/lib/mapStyle.ts`, change:

```ts
      attribution: 'Tiles © Esri'
```

to:

```ts
      attribution: 'Tiles © Esri | Data © OpenStreetMap contributors'
```

(Only the satellite style — the OSM basemap further down already credits OSM.)

- [ ] **Step 2: Update admin-web HoleManager attribution**

In `admin-web/src/components/HoleManager.tsx`, change:

```ts
      attribution: 'Tiles &copy; Esri',
```

to:

```ts
      attribution: 'Tiles &copy; Esri | Data &copy; OpenStreetMap contributors',
```

- [ ] **Step 3: Typecheck both packages**

Run: `npm --prefix webbapp run typecheck && npm --prefix admin-web run typecheck`
(If a package lacks a `typecheck` script, run its `lint` script instead, per CLAUDE.md.)
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add webbapp/src/lib/mapStyle.ts admin-web/src/components/HoleManager.tsx
git commit -m "ui: credit OpenStreetMap data on satellite map styles"
```

Note for the eventual PR: this is a visual change — per CLAUDE.md, attach screenshots of one map view per app (`tools/pr-screenshots/`).

---

### Task 7: README + CLAUDE.md workflow docs

**Files:**
- Create: `tools/course-geometry/README.md`
- Modify: `CLAUDE.md` (add a section after "Pull requests with frontend changes")

- [ ] **Step 1: Write `tools/course-geometry/README.md`**

```markdown
# course-geometry

Import green polygons for a course from OpenStreetMap and preview them on
satellite imagery. Greens only — tees, bunkers, fairways stay manual.

Requirements: Node ≥ 20, backend running (`npm --prefix backend run dev:local`),
an admin account (defaults to the seeded `admin@golf.test` / `Admin123!`).
Preview borrows Playwright from `../pr-screenshots` — run `npm install` there once.

## Usage

```bash
# 1. Fetch from OSM, match to holes, validate — writes greens.<courseId>.json
node import-greens.mjs --course-id <id> --club "Vasatorp" --dry-run

# 2. Render one PNG per hole for visual review
node preview.mjs greens.<courseId>.json

# 3. Import (merge-safe: only greenPolygon is written; holes that already
#    have a green are skipped unless --force)
node import-greens.mjs --course-id <id> --club "Vasatorp"
```

| Flag | Meaning |
|------|---------|
| `--course-id` | Course cuid in the GolfTrainer DB (required) |
| `--club` | OSM name regex for the `leisure=golf_course` polygon |
| `--course` | Extra name regex for multi-course clubs (run once without it; the error lists candidates) |
| `--api-base` | Backend URL, default `http://localhost:3000` (env `GT_API_BASE`) |
| `--email` / `--password` | Admin login (env `GT_ADMIN_EMAIL` / `GT_ADMIN_PASSWORD`) |
| `--dry-run` | Everything except the PATCH calls |
| `--force` | Overwrite holes that already have a `greenPolygon` |
| `--from-json` | Skip OSM; import from an (edited) `greens.<courseId>.json` |

Exit codes: `0` all holes resolved, `1` fatal error, `2` finished but some
holes are unresolved (see the printed table).

Hole statuses in `greens.<courseId>.json`: `matched`, `ambiguous` (two greens
nearly equidistant — resolve by eye), `unmatched` (no green within 80 m),
`no-hole-way`, `duplicate-hole-ways`.

## Agent workflow ("måla upp hålen för <klubb>")

1. Find the course: `GET /api/v1/courses?search=<name>`. Create it first via
   the three REST calls in CLAUDE.md if it does not exist.
2. Run the dry-run. For multi-course clubs, expect the duplicate-refs error,
   pick the right candidate name, re-run with `--course`.
3. Render previews and inspect every PNG — the polygon must sit on the green
   surface, not on a fringe, bunker or the wrong green.
4. For `ambiguous`/`unmatched` holes: fetch Esri tiles around the hole-way
   end point at z19 (`.../World_Imagery/MapServer/tile/19/{y}/{x}`), trace
   the green outline visually, convert pixel → lat/lng with
   `worldPixelToLngLat` in `lib/geo.mjs`, edit the JSON (set `status:
   "matched"`, fill `polygon`), re-run preview, then import with
   `--from-json`. Never guess — a hole you cannot see clearly stays
   unresolved and is reported to the user.
5. Import, then share the per-hole report and the previews with the user.

## Licensing

Green geometry sourced from OSM is ODbL — keep the "Data © OpenStreetMap
contributors" attribution on the satellite map styles (webbapp `mapStyle.ts`,
admin-web `HoleManager.tsx`).
```

- [ ] **Step 2: Add a section to `CLAUDE.md`**

Insert after the "Pull requests with frontend changes" section:

```markdown
## Painting greens (hole geometry)

Green polygons are imported from OpenStreetMap, not hand-drawn. Tooling lives
in `tools/course-geometry/` (see its README for the full agent workflow,
including the satellite-tracing fallback for holes OSM lacks):

```bash
cd tools/course-geometry
node import-greens.mjs --course-id <id> --club "<klubb>" --dry-run
node preview.mjs greens.<id>.json          # PNG per hole — inspect before importing
node import-greens.mjs --course-id <id> --club "<klubb>"
```

Only fall back to hand-drawing in admin-web's HoleManager when OSM has no
data and satellite tracing fails.
```

- [ ] **Step 3: Commit**

```bash
git add tools/course-geometry/README.md CLAUDE.md
git commit -m "docs(tools): course-geometry README and CLAUDE.md workflow"
```

---

### Task 8: End-to-end verification against the local stack

**Files:** none (verification only; fix-up commits if bugs surface)

- [ ] **Step 1: Start the local stack**

```bash
docker start golftrainer-db                  # local Postgres on :5433
npm --prefix backend run dev:local &         # :3000
npm --prefix backend run prisma:seed:local   # if not already seeded
```

- [ ] **Step 2: Create a throwaway test course (Vasatorp, 18 holes)**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@golf.test","password":"Admin123!"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
COURSE_ID=$(curl -s -X POST http://localhost:3000/api/v1/courses \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"clubName":"Vasatorps GK","courseName":"E2E-test","holeCount":18}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
curl -s -X POST "http://localhost:3000/api/v1/courses/$COURSE_ID/holes" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"holeCount":18}' > /dev/null
echo "$COURSE_ID"
```

- [ ] **Step 3: Dry-run — multi-course disambiguation path**

Run: `cd tools/course-geometry && node import-greens.mjs --course-id $COURSE_ID --club "Vasatorp" --dry-run`
Expected: exits 1 with the duplicate-refs error listing candidate course polygon names (Vasatorp has several courses in OSM — verified 2026-07-10: 57 hole ways, 63 greens across the club).

Re-run with `--course "<one candidate from the list>"`.
Expected: exit 0, table shows 18 `would-import` rows (or `2` with a few unresolved — record which).

- [ ] **Step 4: Preview and inspect**

Run: `node preview.mjs greens.$COURSE_ID.json`
Expected: one PNG per matched hole. Open several — each polygon must sit on a green in the imagery.

- [ ] **Step 5: Import and verify in the DB**

Run: `node import-greens.mjs --course-id $COURSE_ID --club "Vasatorp" --course "<candidate>"`
Expected: `imported` rows in the table.

Verify via API:

```bash
curl -s "http://localhost:3000/api/v1/courses/$COURSE_ID" -H "Authorization: Bearer $TOKEN" \
  | node -pe 'const c=JSON.parse(require("fs").readFileSync(0)); c.holes.map(h=>`${h.holeNumber}: ${h.layout.geometry.greenPolygon.length} pts, status ${h.layout.layoutStatus}`).join("\n")'
```

Expected: matched holes show ≥ 3 points. Also open admin-web HoleManager for the course and eyeball a few holes.

- [ ] **Step 6: Verify merge-safety (skip + --force preserves other fields)**

```bash
# Give hole 1 a teePoint alongside its imported green
GREEN1=$(curl -s "http://localhost:3000/api/v1/courses/$COURSE_ID" -H "Authorization: Bearer $TOKEN" \
  | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)).holes[0].layout.geometry.greenPolygon)')
curl -s -X PATCH "http://localhost:3000/api/v1/courses/$COURSE_ID/holes/1/layout" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"geometry\":{\"teePoint\":{\"lat\":56.09,\"lng\":12.92},\"greenPolygon\":$GREEN1,\"bunkerPolygons\":[],\"treesPolygons\":[],\"obPolygons\":[]}}" > /dev/null
```

Re-run import **without** `--force`.
Expected: every hole `skipped-existing`, exit 0.

Re-run **with** `--force`, then fetch hole 1:

```bash
curl -s "http://localhost:3000/api/v1/courses/$COURSE_ID" -H "Authorization: Bearer $TOKEN" \
  | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)).holes[0].layout.geometry.teePoint)'
```

Expected: teePoint still `{"lat":56.09,"lng":12.92}` — only `greenPolygon` was rewritten.

- [ ] **Step 7: 9-hole course check**

Repeat steps 2–5 with `holeCount: 9` and a Swedish 9-hole club of your choice (create the course with `"holeCount":9`). If the first pick has no OSM greens the run reports it cleanly (exit 1 or unresolved rows) — that error path is itself part of the check; then pick another club with data.

- [ ] **Step 8: Clean up test courses**

```bash
curl -s -X DELETE "http://localhost:3000/api/v1/courses/$COURSE_ID" -H "Authorization: Bearer $TOKEN"
```

(Repeat for the 9-hole course id.)

- [ ] **Step 9: Full test suite + commit any fixes**

Run: `cd tools/course-geometry && npm test`
Expected: all passing. Commit fixes as `fix(tools): ...` if the E2E run surfaced bugs.
