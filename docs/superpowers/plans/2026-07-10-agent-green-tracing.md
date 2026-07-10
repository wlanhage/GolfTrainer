# Agent Green Tracing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tooling so the agent can produce green polygons by *looking at* georeferenced satellite snapshots (`snap.mjs` + `trace.mjs`), plus data-flow changes so every unresolved hole carries enough context (lookAt targets, raw OSM dumps) to be resolved without re-querying, and a documented numbering ladder (banguide research first, ask-the-user last).

**Architecture:** Two new pure libs (`georef`, `tiles` — the latter extracted from `preview.mjs`), two new thin CLIs (`snap.mjs`, `trace.mjs`), small extensions to `match.mjs`/`osm.mjs`/`import-greens.mjs`. No new dependencies; Playwright reused from `tools/pr-screenshots/`.

**Tech Stack:** Node ≥ 20, Overpass API (`out tags bb`), Esri World Imagery tiles, Playwright (existing install).

**Spec:** `docs/superpowers/specs/2026-07-10-agent-green-tracing-design.md`

**Context for the engineer:** `tools/course-geometry/` already contains a reviewed, E2E-verified OSM green importer. Read its `README.md` and skim `lib/geo.mjs` (exports `lngLatToWorldPixel`/`worldPixelToLngLat`), `lib/match.mjs` (`validateGreen` returns `{ok, area, reasons, ring}`), `lib/osm.mjs` (`esc`, `fetchOverpass`), `preview.mjs`. The unit suite (`npm test` in the tool dir) currently passes 21/21. Points are `{lat, lng}`; polygons are stored as open rings.

---

### Task 1: Georef math (`lib/georef.mjs`)

**Files:**
- Create: `tools/course-geometry/lib/georef.mjs`
- Test: `tools/course-geometry/test/georef.test.mjs`

- [ ] **Step 1: Write the failing tests**

`tools/course-geometry/test/georef.test.mjs`:

```js
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
});

test('parseMarks parses labels and rejects garbage', () => {
  assert.deepEqual(parseMarks('A:10,20 B:30.5,40'), [
    { label: 'A', x: 10, y: 20 },
    { label: 'B', x: 30.5, y: 40 }
  ]);
  assert.throws(() => parseMarks('A-10,20'), /bad mark/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/course-geometry && npm test`
Expected: FAIL — `Cannot find module '../lib/georef.mjs'` (21 existing tests still pass)

- [ ] **Step 3: Implement `lib/georef.mjs`**

```js
// Georeferencing for satellite snapshots. A georef pins a rendered PNG to the
// Web Mercator world-pixel grid: zoom + world pixel of the PNG's top-left.
import { lngLatToWorldPixel, worldPixelToLngLat } from './geo.mjs';

const TILE = 256;

export function makeGeorefFromCenter({ lat, lng }, zoom, grid) {
  const c = lngLatToWorldPixel({ lat, lng }, zoom);
  const half = (grid * TILE) / 2;
  const originX = Math.floor((c.x - half) / TILE) * TILE;
  const originY = Math.floor((c.y - half) / TILE) * TILE;
  return { zoom, originX, originY, widthPx: grid * TILE, heightPx: grid * TILE };
}

// Highest zoom (19..12) whose bbox fits within maxSidePx, tile-aligned.
export function makeGeorefFromBounds({ minLat, minLng, maxLat, maxLng }, maxSidePx = 2560) {
  for (let zoom = 19; zoom >= 12; zoom--) {
    const nw = lngLatToWorldPixel({ lat: maxLat, lng: minLng }, zoom);
    const se = lngLatToWorldPixel({ lat: minLat, lng: maxLng }, zoom);
    if (Math.max(se.x - nw.x, se.y - nw.y) <= maxSidePx) {
      const originX = Math.floor(nw.x / TILE) * TILE;
      const originY = Math.floor(nw.y / TILE) * TILE;
      return {
        zoom,
        originX,
        originY,
        widthPx: Math.ceil((se.x - originX) / TILE) * TILE,
        heightPx: Math.ceil((se.y - originY) / TILE) * TILE
      };
    }
  }
  throw new Error('Bounds too large for a single snapshot even at zoom 12');
}

// "x,y x,y ..." (pixels in the snapshot frame) → [{lat, lng}, ...]
export function pixelsToPolygon(georef, pointsStr) {
  const pairs = String(pointsStr).trim().split(/\s+/);
  if (pairs.length < 3) throw new Error(`need at least 3 points, got ${pairs.length}`);
  return pairs.map((pair) => {
    const m = pair.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (!m) throw new Error(`bad point "${pair}" — expected "x,y"`);
    return worldPixelToLngLat(
      { x: georef.originX + Number(m[1]), y: georef.originY + Number(m[2]) },
      georef.zoom
    );
  });
}

// "A:x,y B:x,y" → [{label, x, y}]
export function parseMarks(marksStr) {
  return String(marksStr)
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const m = tok.match(/^([A-Za-z0-9]+):(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
      if (!m) throw new Error(`bad mark "${tok}" — expected "LABEL:x,y"`);
      return { label: m[1], x: Number(m[2]), y: Number(m[3]) };
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/course-geometry && npm test`
Expected: 27 passing (21 + 6)

- [ ] **Step 5: Commit**

```bash
git add tools/course-geometry/lib/georef.mjs tools/course-geometry/test/georef.test.mjs
git commit -m "feat(tools): georef math for satellite snapshots"
```

---

### Task 2: Shared tile renderer (`lib/tiles.mjs`) + preview refactor

**Files:**
- Create: `tools/course-geometry/lib/tiles.mjs`
- Modify: `tools/course-geometry/preview.mjs` (full rewrite below)

No new unit tests (rendering is integration-verified); the existing suite must stay green and the preview smoke test must reproduce.

- [ ] **Step 1: Implement `lib/tiles.mjs`** (logic extracted from preview.mjs)

```js
// Esri World Imagery tile grid rendering, shared by preview/snap/trace.
// Reuses the Playwright install from ../../pr-screenshots.
import { createRequire } from 'node:module';

const TILE = 256;

// HTML page: absolutely-positioned tiles covering the georef frame, with an
// optional SVG overlay (polygon, labels, marks) on top.
export function tileGridHtml(georef, overlaySvg = '') {
  const { zoom, originX, originY, widthPx, heightPx } = georef;
  const imgs = [];
  for (let tx = Math.floor(originX / TILE); tx * TILE < originX + widthPx; tx++) {
    for (let ty = Math.floor(originY / TILE); ty * TILE < originY + heightPx; ty++) {
      imgs.push(
        `<img src="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}"` +
          ` style="position:absolute;left:${tx * TILE - originX}px;top:${ty * TILE - originY}px;width:${TILE}px;height:${TILE}px">`
      );
    }
  }
  return `<!doctype html><body style="margin:0;position:relative;width:${widthPx}px;height:${heightPx}px;background:#000">
${imgs.join('\n')}
<svg width="${widthPx}" height="${heightPx}" style="position:absolute;left:0;top:0">${overlaySvg}</svg></body>`;
}

// Render pages sequentially in one browser; prints each output path.
export async function renderPagesToPngs(pages) {
  const require = createRequire(new URL('../../pr-screenshots/package.json', import.meta.url));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
    for (const { html, outPath } of pages) {
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.locator('body').screenshot({ path: outPath });
      console.log(outPath);
    }
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: Rewrite `preview.mjs` to use it** (behavior identical: same tile URLs, offsets, SVG, crop; the skipped-holes join gains a `?? '?'`)

```js
#!/usr/bin/env node
// Render one PNG per hole: Esri satellite tiles + the green polygon overlay.
//
// Usage: node preview.mjs greens.<courseId>.json [outDir]
//
// Reuses the Playwright install from ../pr-screenshots (npm install there once).
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lngLatToWorldPixel } from './lib/geo.mjs';
import { tileGridHtml, renderPagesToPngs } from './lib/tiles.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const ZOOM = 19;
const MARGIN_PX = 60;

function pageForHole(entry) {
  const px = entry.polygon.map((p) => lngLatToWorldPixel(p, ZOOM));
  const originX = Math.min(...px.map((p) => p.x)) - MARGIN_PX;
  const originY = Math.min(...px.map((p) => p.y)) - MARGIN_PX;
  const widthPx = Math.ceil(Math.max(...px.map((p) => p.x)) + MARGIN_PX - originX);
  const heightPx = Math.ceil(Math.max(...px.map((p) => p.y)) + MARGIN_PX - originY);
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx)) {
    throw new Error(`hole ${entry.holeNumber}: bad polygon (non-numeric coordinates)`);
  }
  const pts = px.map((p) => `${(p.x - originX).toFixed(1)},${(p.y - originY).toFixed(1)}`).join(' ');
  const label = `Hål ${entry.holeNumber}${entry.status && entry.status !== 'matched' ? ` (${entry.status})` : ''}`;
  const overlay =
    `<polygon points="${pts}" fill="rgba(80,220,120,.25)" stroke="#3ddc84" stroke-width="2"/>` +
    `<text x="8" y="22" style="font:bold 15px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px">${label}</text>`;
  return tileGridHtml({ zoom: ZOOM, originX, originY, widthPx, heightPx }, overlay);
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Usage: node preview.mjs greens.<courseId>.json [outDir]');
  process.exit(1);
}
const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
const outDir = process.argv[3] ?? `${here}/out`;
mkdirSync(outDir, { recursive: true });

const pages = data.holes
  .filter((h) => h?.polygon)
  .map((entry) => ({
    html: pageForHole(entry),
    outPath: `${outDir}/hole-${String(entry.holeNumber).padStart(2, '0')}.png`
  }));
await renderPagesToPngs(pages);

const skipped = data.holes.filter((h) => !h?.polygon).map((h) => h?.holeNumber ?? '?');
if (skipped.length > 0) console.log(`No polygon (not rendered): holes ${skipped.join(', ')}`);
```

- [ ] **Step 3: Verify suite + preview smoke**

Run: `cd tools/course-geometry && npm test` → 27 passing.
Smoke (scratchpad fixture from the earlier work, or recreate it):

```bash
SCRATCH=/private/tmp/claude-501/-Users-williamlanhage-GolfTrainer/65617395-dbd5-4982-a8b4-99915abd6a0a/scratchpad
cat > "$SCRATCH/greens.smoke.json" <<'EOF'
{ "courseId": "smoke", "holes": [ { "holeNumber": 1, "status": "matched", "polygon": [
  { "lat": 33.50073, "lng": -82.02036 }, { "lat": 33.50073, "lng": -82.01964 },
  { "lat": 33.50127, "lng": -82.01964 }, { "lat": 33.50127, "lng": -82.02036 } ] } ] }
EOF
node preview.mjs "$SCRATCH/greens.smoke.json" "$SCRATCH/preview-refactor-out"
```

Expected: `hole-01.png` rendered, cropped to the map area (~450×480 px), real imagery, polygon + "Hål 1" label — visually inspect it.

- [ ] **Step 4: Commit**

```bash
git add tools/course-geometry/lib/tiles.mjs tools/course-geometry/preview.mjs
git commit -m "refactor(tools): shared tile renderer, preview uses it"
```

---

### Task 3: Course bounds query (`lib/osm.mjs`)

**Files:**
- Modify: `tools/course-geometry/lib/osm.mjs` (add two exports at the end)
- Test: `tools/course-geometry/test/osm.test.mjs` (append two tests)

- [ ] **Step 1: Append the failing tests to `test/osm.test.mjs`**

```js
import { buildCourseBoundsQuery, parseCourseBounds } from '../lib/osm.mjs';
```
(merge this into the existing import line from `../lib/osm.mjs`)

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/course-geometry && npm test`
Expected: the two new tests FAIL (`buildCourseBoundsQuery is not a function` or similar); rest pass.

- [ ] **Step 3: Implement in `lib/osm.mjs`** (append; `esc` already exists in the file)

```js
// Bounds-only lookup of a club's golf_course polygon(s) — works even when
// the club has no holes/greens mapped. Used by snap.mjs --overview.
export function buildCourseBoundsQuery({ club, course }) {
  const nameFilters =
    `["name"~"${esc(club)}",i]` + (course ? `["name"~"${esc(course)}",i]` : '');
  return `[out:json][timeout:30];
area["ISO3166-1"="SE"][admin_level=2]->.se;
(
  way(area.se)["leisure"="golf_course"]${nameFilters};
  relation(area.se)["leisure"="golf_course"]${nameFilters};
);
out tags bb;`;
}

// → [{ name, bounds: {minLat, minLng, maxLat, maxLng} }]
export function parseCourseBounds(json) {
  return (json.elements ?? [])
    .filter((el) => el.bounds)
    .map((el) => ({
      name: el.tags?.name ?? `${el.type}/${el.id}`,
      bounds: {
        minLat: el.bounds.minlat,
        minLng: el.bounds.minlon,
        maxLat: el.bounds.maxlat,
        maxLng: el.bounds.maxlon
      }
    }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/course-geometry && npm test`
Expected: 29 passing

- [ ] **Step 5: Commit**

```bash
git add tools/course-geometry/lib/osm.mjs tools/course-geometry/test/osm.test.mjs
git commit -m "feat(tools): course bounds query for overview snaps"
```

---

### Task 4: `snap.mjs` CLI

**Files:**
- Create: `tools/course-geometry/snap.mjs`
- Modify: `.gitignore` (repo root — extend the existing course-geometry block)

- [ ] **Step 1: Implement `snap.mjs`**

```js
#!/usr/bin/env node
// Georeferenced satellite snapshot the agent can trace on.
//
// Usage:
//   node snap.mjs --center <lat,lng> [--zoom 19] [--grid 3] [--name <name>]
//   node snap.mjs --club "<klubb>" [--course "<bana>"] --overview [--name <name>]
//
// Writes snap.<name>.png + snap.<name>.json (the georef sidecar trace.mjs
// needs to convert pixel coordinates back to lat/lng).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeGeorefFromCenter, makeGeorefFromBounds } from './lib/georef.mjs';
import { tileGridHtml, renderPagesToPngs } from './lib/tiles.mjs';
import { buildCourseBoundsQuery, parseCourseBounds, fetchOverpass } from './lib/osm.mjs';

function parseArgs(argv) {
  const args = { zoom: 19, grid: 3, overview: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--center') args.center = argv[++i];
    else if (a === '--zoom') args.zoom = Number(argv[++i]);
    else if (a === '--grid') args.grid = Number(argv[++i]);
    else if (a === '--club') args.club = argv[++i];
    else if (a === '--course') args.course = argv[++i];
    else if (a === '--overview') args.overview = true;
    else if (a === '--name') args.name = argv[++i];
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.center && !(args.club && args.overview)) {
    throw new Error('Need --center <lat,lng> or --club "<name>" --overview');
  }
  return args;
}

const args = parseArgs(process.argv);
const here = fileURLToPath(new URL('.', import.meta.url));

let georef;
let defaultName;
if (args.center) {
  const m = String(args.center).match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) throw new Error(`bad --center "${args.center}" — expected "lat,lng"`);
  georef = makeGeorefFromCenter({ lat: Number(m[1]), lng: Number(m[2]) }, args.zoom, args.grid);
  defaultName = `${m[1]}_${m[2]}_z${args.zoom}`;
} else {
  const courses = parseCourseBounds(await fetchOverpass(buildCourseBoundsQuery(args)));
  if (courses.length === 0) {
    console.error(`No leisure=golf_course matched "${args.club}"${args.course ? ` + "${args.course}"` : ''}.`);
    process.exit(1);
  }
  if (courses.length > 1) {
    console.error(`Several courses matched: ${courses.map((c) => c.name).join(' | ')}. Narrow with --course.`);
    process.exit(1);
  }
  georef = makeGeorefFromBounds(courses[0].bounds);
  defaultName = courses[0].name.toLowerCase().replace(/[^a-z0-9åäö]+/g, '-');
}

const name = args.name ?? defaultName;
const png = `${here}snap.${name}.png`;
const sidecar = `${here}snap.${name}.json`;
await renderPagesToPngs([{ html: tileGridHtml(georef), outPath: png }]);
writeFileSync(sidecar, JSON.stringify(georef, null, 2));
console.log(sidecar);
console.log(`zoom ${georef.zoom}, ${georef.widthPx}x${georef.heightPx} px, origin ${georef.originX},${georef.originY}`);
```

- [ ] **Step 2: Extend `.gitignore`** — in the existing `# Course-geometry import artifacts` block, add:

```
tools/course-geometry/snap.*
```

- [ ] **Step 3: Smoke tests**

```bash
cd tools/course-geometry
node snap.mjs                                   # → error: Need --center ... (exit 1)
node snap.mjs --center "33.501,-82.020" --grid 2 --name smoketest
```

Expected: writes `snap.smoketest.png` (512×512, real imagery — Augusta area has z19 coverage) + `snap.smoketest.json` with `{zoom:19, originX, originY, widthPx:512, heightPx:512}`. Open the PNG and confirm imagery. Then `git status` — both snap files must be ignored.

- [ ] **Step 4: Commit**

```bash
git add tools/course-geometry/snap.mjs .gitignore
git commit -m "feat(tools): snap CLI for georeferenced satellite crops"
```

---

### Task 5: `trace.mjs` CLI

**Files:**
- Create: `tools/course-geometry/trace.mjs`

- [ ] **Step 1: Implement `trace.mjs`**

```js
#!/usr/bin/env node
// Turn traced pixel coordinates on a snap into a green polygon in a
// greens.<courseId>.json — or render letter marks for the ask-the-user
// numbering fallback.
//
// Usage:
//   node trace.mjs snap.<name>.json --hole 7 --points "x,y x,y x,y ..." --into greens.<courseId>.json
//   node trace.mjs snap.<name>.json --mark "A:x,y B:x,y" [--out marked.png]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pixelsToPolygon, parseMarks } from './lib/georef.mjs';
import { validateGreen } from './lib/match.mjs';
import { tileGridHtml, renderPagesToPngs } from './lib/tiles.mjs';

function parseArgs(argv) {
  const args = { snap: argv[2] };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--hole') args.hole = Number(argv[++i]);
    else if (a === '--points') args.points = argv[++i];
    else if (a === '--into') args.into = argv[++i];
    else if (a === '--mark') args.mark = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.snap || args.snap.startsWith('--')) {
    throw new Error('Usage: node trace.mjs snap.<name>.json (--hole N --points "x,y ..." --into greens.json | --mark "A:x,y ...")');
  }
  if (!args.mark && !(Number.isInteger(args.hole) && args.hole >= 1 && args.points && args.into)) {
    throw new Error('Need either --mark "A:x,y ..." or all of: --hole N --points "x,y x,y x,y" --into greens.<courseId>.json');
  }
  return args;
}

const args = parseArgs(process.argv);
const georef = JSON.parse(readFileSync(args.snap, 'utf8'));

if (args.mark) {
  const marks = parseMarks(args.mark);
  const overlay = marks
    .map(
      (m) =>
        `<circle cx="${m.x}" cy="${m.y}" r="14" fill="rgba(255,80,80,.35)" stroke="#ff5050" stroke-width="2"/>` +
        `<text x="${m.x}" y="${m.y + 6}" text-anchor="middle" style="font:bold 16px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px">${m.label}</text>`
    )
    .join('');
  const out = args.out ?? args.snap.replace(/\.json$/, '.marked.png');
  await renderPagesToPngs([{ html: tileGridHtml(georef, overlay), outPath: out }]);
} else {
  const polygon = pixelsToPolygon(georef, args.points);
  const v = validateGreen(polygon);
  if (!v.ok) {
    console.error(`Refusing hole ${args.hole}: ${v.reasons.join('; ')}`);
    process.exit(1);
  }
  if (!existsSync(args.into)) {
    throw new Error(`${args.into} not found — run import-greens.mjs --dry-run first to create it`);
  }
  const data = JSON.parse(readFileSync(args.into, 'utf8'));
  if (!Array.isArray(data.holes)) throw new Error(`${args.into} has no holes array`);
  const entry = { holeNumber: args.hole, status: 'matched', source: 'traced', polygon: v.ring };
  const idx = data.holes.findIndex((h) => h?.holeNumber === args.hole);
  if (idx >= 0) data.holes[idx] = entry;
  else data.holes.push(entry);
  writeFileSync(args.into, JSON.stringify(data, null, 2));
  console.log(`hole ${args.hole}: ${v.ring.length} pts, ${v.area} m² -> ${args.into}`);
}
```

- [ ] **Step 2: Smoke tests (pure math — no network needed for the --points path)**

```bash
SCRATCH=/private/tmp/claude-501/-Users-williamlanhage-GolfTrainer/65617395-dbd5-4982-a8b4-99915abd6a0a/scratchpad
cd tools/course-geometry

# Synthetic georef: zoom 19 around lat 55.4, and an empty greens file
node --input-type=module -e "
import { makeGeorefFromCenter } from '$PWD/lib/georef.mjs';
import { writeFileSync } from 'node:fs';
const g = makeGeorefFromCenter({ lat: 55.4, lng: 12.85 }, 19, 3);
writeFileSync('$SCRATCH/snap.synthetic.json', JSON.stringify(g));"
echo '{ "courseId": "trace-smoke", "holes": [] }' > "$SCRATCH/greens.smoke2.json"

# ~35×35 px at z19 ≈ 6×6 m — too small, must be refused
node trace.mjs "$SCRATCH/snap.synthetic.json" --hole 1 --points "100,100 135,100 135,135 100,135" --into "$SCRATCH/greens.smoke2.json"
# Expected: "Refusing hole 1: area ... outside 150-1500 m²", exit 1

# ~150×150 px ≈ 25×25 m ≈ 620 m² — accepted
node trace.mjs "$SCRATCH/snap.synthetic.json" --hole 1 --points "100,100 250,100 250,250 100,250" --into "$SCRATCH/greens.smoke2.json"
# Expected: "hole 1: 4 pts, ~600-650 m² -> ..." and the JSON now has one matched entry with source "traced"

# Mark mode (fetches 9 tiles — fine)
node trace.mjs "$SCRATCH/snap.synthetic.json" --mark "A:100,100 B:400,300" --out "$SCRATCH/marked.png"
# Expected: marked.png rendered with two labelled red circles; open and confirm
```

Also verify: `node preview.mjs "$SCRATCH/greens.smoke2.json" "$SCRATCH/trace-preview"` renders the traced square on imagery (placeholder tiles possible at that synthetic spot — that's fine, geometry is what's being checked).

- [ ] **Step 3: Run the unit suite** — `npm test` → 29 passing (unchanged).

- [ ] **Step 4: Commit**

```bash
git add tools/course-geometry/trace.mjs
git commit -m "feat(tools): trace CLI - pixels to green polygons"
```

---

### Task 6: lookAt targets + raw-data dumps (`lib/match.mjs`, `import-greens.mjs`)

**Files:**
- Modify: `tools/course-geometry/lib/match.mjs` (one line in the unmatched branch)
- Modify: `tools/course-geometry/import-greens.mjs` (the OSM else-branch)
- Test: `tools/course-geometry/test/match.test.mjs` (append one test)

- [ ] **Step 1: Append the failing test to `test/match.test.mjs`**

```js
test('unmatched holes carry a lookAt target (the way end point)', () => {
  const [r] = matchGreens({ holes: [holeWay('1', 56, 56.002)], greens: [], holeCount: 1 });
  assert.equal(r.status, 'unmatched');
  assert.deepEqual(r.lookAt, { lat: 56.002, lng: 12 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tools/course-geometry && npm test`
Expected: the new test FAILS (`lookAt` undefined); 29 others pass.

- [ ] **Step 3: Implement in `lib/match.mjs`** — in `matchGreens`, change the no-hit branch:

```js
    if (!hit) {
      results.push({
        holeNumber: n,
        status: 'unmatched',
        // Where the agent should point snap.mjs --center when tracing.
        lookAt: way.points[way.points.length - 1]
      });
      continue;
    }
```

- [ ] **Step 4: Run tests** — `npm test` → 30 passing.

- [ ] **Step 5: Rework `import-greens.mjs`'s OSM branch** so every gap case leaves a usable JSON behind. Replace the whole `else { ... }` block (the non-`fromJson` path) with:

```js
} else {
  const jsonPath = fileURLToPath(new URL(`greens.${args.courseId}.json`, import.meta.url));
  const osm = parseOverpass(await fetchOverpass(buildOverpassQuery(args)));
  console.log(
    `OSM: ${osm.courseNames.length} course polygon(s), ${osm.holes.length} hole way(s), ${osm.greens.length} green(s)`
  );
  if (osm.holes.length === 0 && osm.greens.length === 0) {
    // Case C: nothing mapped. Leave a skeleton so trace.mjs --into works.
    writeFileSync(jsonPath, JSON.stringify({ courseId: args.courseId, club: args.club, holes: [] }, null, 2));
    console.error(
      `No golf=hole or golf=green in OSM for "${args.club}". Candidate course polygons: ${
        osm.courseNames.join(' | ') || 'none'
      }. Wrote empty ${jsonPath} — use the tracing workflow (README).`
    );
    process.exit(1);
  }
  const refs = osm.holes.map((h) => h.ref).filter(Boolean);
  const dupes = [...new Set(refs.filter((r, i) => refs.indexOf(r) !== i))];
  if (dupes.length > 0) {
    // Case B: ambiguous assignment. Dump the raw data for manual assignment.
    writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          courseId: args.courseId,
          club: args.club,
          holes: [],
          unassigned: { holeWays: osm.holes, greens: osm.greens }
        },
        null,
        2
      )
    );
    console.error(
      `Duplicate hole refs (${dupes.join(', ')}) — matched course polygon(s): ${osm.courseNames.join(' | ')}.` +
        (args.course
          ? ' --course did not isolate a single course.'
          : ' Narrow the search with --course.') +
        ` Raw ways/greens dumped to ${jsonPath} for manual assignment (see README).`
    );
    process.exit(1);
  }
  entries = matchGreens({ holes: osm.holes, greens: osm.greens, holeCount: course.holeCount });
  writeFileSync(jsonPath, JSON.stringify({ courseId: args.courseId, club: args.club, holes: entries }, null, 2));
  console.log(`Wrote ${jsonPath}`);
}
```

Notes: this removes the old `osm.greens.length === 0` hard-exit — a club with hole ways but no greens (Söderslätts GK) now produces 1..N `unmatched` entries, each with `lookAt`, and exits 2 via the normal report. The `fileURLToPath` import already exists from the earlier artifact-anchoring fix.

- [ ] **Step 6: Smoke + suite**

```bash
cd tools/course-geometry
node import-greens.mjs --club "X"        # still: Missing --course-id
npm test                                  # 30 passing
```

- [ ] **Step 7: Commit**

```bash
git add tools/course-geometry/lib/match.mjs tools/course-geometry/test/match.test.mjs tools/course-geometry/import-greens.mjs
git commit -m "feat(tools): lookAt targets and raw-data dumps for unresolved courses"
```

---

### Task 7: README tracing ladder

**Files:**
- Modify: `tools/course-geometry/README.md`

- [ ] **Step 1: Update the Usage flag docs.** After the existing flags table, the "Hole statuses" paragraph gains one clause — extend the `unmatched` description from "(no green within 80 m)" to "(no green within 80 m — the entry carries `lookAt`, the hole way's end point, for the tracing workflow)".

- [ ] **Step 2: Replace step 4 of the "Agent workflow" section** (the old satellite-tracing paragraph) with a pointer: "For `ambiguous`/`unmatched`/undumped holes, follow **Tracing & assignment (no OSM data)** below." Keep steps 1–3 and 5 unchanged.

- [ ] **Step 3: Insert a new section between "Agent workflow" and "Licensing":**

```markdown
## Tracing & assignment (no OSM data)

A ladder — take the first rung that applies, and never guess:

**A. Hole way exists, green missing** (`status: "unmatched"`, entry has `lookAt`):

```bash
node snap.mjs --center "<lookAt.lat>,<lookAt.lng>"        # writes snap.<name>.png + .json
# open the PNG, read pixel coords of the green outline (8-12 vertices), then:
node trace.mjs snap.<name>.json --hole <N> --points "x,y x,y ..." --into greens.<courseId>.json
node preview.mjs greens.<courseId>.json                    # verify the polygon sits on the green
node import-greens.mjs --course-id <id> --from-json greens.<courseId>.json
```

Numbering comes free from the OSM hole way's `ref`. Use `--zoom 18` if z19
shows "Map data not yet available".

**B. Multi-course club, duplicate refs** (`greens.<courseId>.json` has an
`unassigned` block with all raw hole ways and greens): do NOT trace — the OSM
green polygons are better than hand-traced ones; only the hole↔green
assignment is ambiguous. Research the club's **banguide** (club website,
web-search "<klubb> banguide", Caddee) — per-hole aerial images show each
course's routing. Compare against `node snap.mjs --club "<klubb>" --overview`,
then build `holes` entries in the JSON by copying polygons from
`unassigned.greens` (set `holeNumber`, `status: "matched"`,
`source: "banguide:<url>"`). Then preview + import with `--from-json`.

**C. Nothing in OSM** (empty skeleton JSON was written):
`node snap.mjs --club "<klubb>" --overview`, find the greens visually,
research the banguide for numbering, then per green:
`snap.mjs --center` + `trace.mjs` as in A.

**D. No banguide found or not matchable:** make a letter map and ask the user
for the mapping (one short question), then proceed as in A/B:

```bash
node trace.mjs snap.<name>.json --mark "A:x,y B:x,y C:x,y"
```

**E. Still unclear** (shadow, tree cover, no imagery at any zoom): leave the
hole unresolved and say so in the report. Record which rung and which source
(banguide URL, user confirmation) resolved each hole.
```

- [ ] **Step 4: Sanity-check** the README renders (fences balanced — note the nested bash blocks) and that flag/behavior claims match the code (`snap.mjs`/`trace.mjs` usage lines, the case-B/C dump behavior from Task 6).

- [ ] **Step 5: Commit**

```bash
git add tools/course-geometry/README.md
git commit -m "docs(tools): tracing and assignment ladder in README"
```

---

### Task 8: Live verification (agent-run, real data)

**Files:** none (fix-up commits only if bugs surface)

Requires the local stack (Docker `golftrainer-db`, backend `dev:local` on :3000, seeded admin) — same as the previous E2E.

- [ ] **Step 1: Case A end-to-end — Söderslätts GK** (known from the earlier E2E: 9 hole ways, 0 greens):
  - Create a throwaway 9-hole course via the three REST calls (CLAUDE.md).
  - `node import-greens.mjs --course-id $ID --club "Söderslätt" --dry-run` → expect 9 `unmatched` rows, exit 2, and `greens.$ID.json` where every entry has `lookAt`.
  - Pick two holes; `node snap.mjs --center "<lookAt>"` each; **look at the PNGs**, trace the green outlines (8–12 vertices each) with `trace.mjs --points`.
  - `node preview.mjs greens.$ID.json` → inspect: traced polygons must sit on the greens.
  - `node import-greens.mjs --course-id $ID --from-json greens.$ID.json` → 2 `imported`, 7 `unmatched`, exit 2. Verify via GET that the two holes have ≥3-point greenPolygons.
- [ ] **Step 2: Case B dump — Vasatorp:** `node import-greens.mjs --course-id $ID --club "Vasatorp" --dry-run` (reuse the throwaway course) → exit 1 and `greens.$ID.json` containing `unassigned.holeWays` (~57) and `unassigned.greens` (~63).
- [ ] **Step 3: Banguide research probe:** web-search "Söderslätts GK banguide" (or the club site). Record whether a per-hole guide exists and whether its hole-1 image is matchable against an `--overview` snap. This validates rung B/C's research step — a negative result is a valid, recorded outcome.
- [ ] **Step 4: Overview snap:** `node snap.mjs --club "Söderslätt" --overview` → PNG covering the whole course at a sane zoom (15–17), sidecar georef consistent.
- [ ] **Step 5: Cleanup:** DELETE the throwaway course; `npm test` → 30 passing; `git status` clean apart from ignored artifacts and `AGENTS.md`.
