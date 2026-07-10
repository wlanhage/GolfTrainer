# Tee Import & Hole Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch `golf=tee` from OSM, auto-select the right tee per hole via scorecard length, import it as `teePoint`, and add an `assign.mjs` distance-matrix CLI so ambiguous multi-course clubs (case B) are resolved by arithmetic + banguide instead of guesswork — verified by importing Albatross GK (18 + 9 holes) for real.

**Architecture:** Extend `lib/osm.mjs` (tee fetch/parse) and `lib/match.mjs` (`pickTee`, optional tees/lengths in `matchGreens` — strictly back-compatible), wire through `import-greens.mjs` (teePoint PATCH, tees in dumps), add thin `assign.mjs` CLI, upgrade README rung B. No new dependencies, no backend changes.

**Tech Stack:** Node ≥ 20, Overpass API, existing course-geometry libs.

**Spec:** `docs/superpowers/specs/2026-07-10-tee-assignment-design.md`

**Context for the engineer:** `tools/course-geometry/` is a reviewed, live-verified tool (README + CLAUDE.md section). Current suite: 30/30 via `npm test` in the tool dir. Key existing contracts: `parseOverpass` → `{courseNames, holes, greens}`; `matchGreens({holes, greens, holeCount})` → entries with statuses matched/ambiguous/unmatched/no-hole-way/duplicate-hole-ways; `validateGreen` → `{ok, area, reasons, ring}`; `import-greens.mjs` merge-safe PATCH preserves `existing` geometry fields and writes dumps (`unassigned`) for case B / no-hole-ways. `centroid`/`haversineMeters`/`normalizeRing` live in `lib/geo.mjs`.

---

### Task 1: Tees in the Overpass fetch (`lib/osm.mjs`)

**Files:**
- Modify: `tools/course-geometry/lib/osm.mjs`
- Test: `tools/course-geometry/test/osm.test.mjs`

- [ ] **Step 1: Extend the tests (fail first)**

In the existing `buildOverpassQuery` test, add two assertions:

```js
  assert.ok(q.includes('["golf"="tee"]'));
  assert.ok(q.includes('node(area.c)["golf"="tee"]'));
```

Append one new test:

```js
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
```

- [ ] **Step 2: Run to verify failure** — `cd tools/course-geometry && npm test`: new assertions/test FAIL, rest pass.

- [ ] **Step 3: Implement.** In `buildOverpassQuery`, extend the second union:

```
(
  way(area.c)["golf"="hole"];
  way(area.c)["golf"="green"];
  way(area.c)["golf"="tee"];
  node(area.c)["golf"="tee"];
);
```

In `parseOverpass`: import `centroid` alongside `normalizeRing` from `./geo.mjs`; add `const tees = [];` and a branch after the green branch:

```js
    else if (tags.golf === 'tee') {
      const point =
        el.type === 'node' && Number.isFinite(el.lat)
          ? { lat: el.lat, lng: el.lon }
          : points.length > 0
            ? centroid(normalizeRing(points))
            : null;
      if (point) tees.push({ id: `${el.type}/${el.id}`, point, ref: tags.ref ?? null, name: tags.name ?? null });
    }
```

Return `{ courseNames, holes, greens, tees }`.

- [ ] **Step 4: `npm test` → 31 passing.**

- [ ] **Step 5: Commit**

```bash
git add tools/course-geometry/lib/osm.mjs tools/course-geometry/test/osm.test.mjs
git commit -m "feat(tools): fetch and parse golf=tee from OSM"
```

---

### Task 2: `pickTee` + tees in `matchGreens` (`lib/match.mjs`)

**Files:**
- Modify: `tools/course-geometry/lib/match.mjs`
- Test: `tools/course-geometry/test/match.test.mjs`

- [ ] **Step 1: Write the failing tests** (append; `M`, `squareGreen`, `holeWay` helpers already exist in the file)

```js
import { matchGreens, validateGreen, pickTee } from '../lib/match.mjs';
```
(merge `pickTee` into the existing import)

```js
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
```

- [ ] **Step 2: Run to verify failure** — `npm test`: new tests FAIL, 30 others pass (the back-compat test may pass immediately — fine, it pins existing behavior).

- [ ] **Step 3: Implement in `lib/match.mjs`.** New constants + export:

```js
export const TEE_BAND_MIN = 0.75; // scorecard length is play-line; straight tee→green is shorter on doglegs
export const TEE_BAND_MAX = 1.05;
export const TEE_TIE_MARGIN_M = 15;
export const TEE_TIE_SPREAD_M = 30;

// Pick the tee whose straight-line distance to the green center best matches
// the scorecard length. Returns {point, distanceM, teeId}, or
// {reason: 'ambiguous-tees'} when two far-apart tees fit equally well, or
// null when nothing lands in the band / inputs are unusable.
export function pickTee({ tees, greenCenter, holeLengthM }) {
  if (!tees?.length || !greenCenter || !Number.isFinite(holeLengthM) || holeLengthM <= 0) return null;
  const candidates = tees
    .map((t) => ({ t, d: haversineMeters(t.point, greenCenter) }))
    .filter(({ d }) => d >= TEE_BAND_MIN * holeLengthM && d <= TEE_BAND_MAX * holeLengthM)
    .sort((a, b) => Math.abs(a.d - holeLengthM) - Math.abs(b.d - holeLengthM));
  const best = candidates[0];
  if (!best) return null;
  const second = candidates[1];
  if (
    second &&
    Math.abs(second.d - holeLengthM) - Math.abs(best.d - holeLengthM) < TEE_TIE_MARGIN_M &&
    haversineMeters(best.t.point, second.t.point) > TEE_TIE_SPREAD_M
  ) {
    return { reason: 'ambiguous-tees' };
  }
  return { point: best.t.point, distanceM: Math.round(best.d), teeId: best.t.id };
}
```

`matchGreens` signature becomes `matchGreens({ holes, greens, holeCount, tees = [], holeLengths = {} })`. In the hit-push block, after the `secondGreenId` spread, add:

```js
    const tee = pickTee({
      tees,
      greenCenter: centroid(hit.green.points),
      holeLengthM: holeLengths[n]
    });
    results.push({
      // ...existing fields unchanged...
      ...(tee?.point ? { teePoint: tee.point, teeDistanceM: tee.distanceM, teeId: tee.teeId } : {}),
      ...(tee?.reason ? { teeNote: tee.reason } : {})
    });
```

(Integrate into the existing single `results.push` — do not duplicate the push.)

- [ ] **Step 4: `npm test` → 37 passing** (31 + 6).

- [ ] **Step 5: Commit**

```bash
git add tools/course-geometry/lib/match.mjs tools/course-geometry/test/match.test.mjs
git commit -m "feat(tools): pick tee per hole from scorecard length"
```

---

### Task 3: Wire tees through `import-greens.mjs`

**Files:**
- Modify: `tools/course-geometry/import-greens.mjs`

- [ ] **Step 1: Apply four changes**

1. OSM log line — add tees:
```js
  console.log(
    `OSM: ${osm.courseNames.length} course polygon(s), ${osm.holes.length} hole way(s), ${osm.greens.length} green(s), ${osm.tees.length} tee(s)`
  );
```
2. Both dump payloads (case B and the no-hole-ways case) gain tees: `unassigned: { holeWays: osm.holes, greens: osm.greens, tees: osm.tees }` (no-hole-ways keeps `holeWays: []`).
3. The `matchGreens` call:
```js
  entries = matchGreens({
    holes: osm.holes,
    greens: osm.greens,
    holeCount: course.holeCount,
    tees: osm.tees,
    holeLengths: Object.fromEntries(course.holes.map((h) => [h.holeNumber, h.length]))
  });
```
4. The PATCH + report: `teePoint: e.teePoint ?? existing.teePoint,` (replaces `teePoint: existing.teePoint,`), and both `imported` and `would-import` report rows gain `tee: e.teePoint ? 'yes' : 'no'`.

- [ ] **Step 2: Verify** — `npm test` → 37; `node import-greens.mjs --club "X"` → still `Missing --course-id`.

- [ ] **Step 3: Commit**

```bash
git add tools/course-geometry/import-greens.mjs
git commit -m "feat(tools): import teePoint and dump tees for assignment"
```

---

### Task 4: `assign.mjs` CLI

**Files:**
- Create: `tools/course-geometry/assign.mjs`

- [ ] **Step 1: Implement**

```js
#!/usr/bin/env node
// Ranked hole↔green assignment candidates from an unassigned dump + the
// course scorecard. Prints arithmetic; writes nothing — the agent copies
// conclusions into the greens JSON (status "matched", source "assign:..."
// or "banguide:<url>") and imports with --from-json.
//
// Usage: node assign.mjs greens.<courseId>.json [--course-id <id>] [--api-base ...] [--json]
import { readFileSync } from 'node:fs';
import { haversineMeters, centroid } from './lib/geo.mjs';
import { pickTee } from './lib/match.mjs';
import { createApi } from './lib/api.mjs';

function parseArgs(argv) {
  const args = {
    dump: argv[2],
    apiBase: process.env.GT_API_BASE ?? 'http://localhost:3000',
    email: process.env.GT_ADMIN_EMAIL ?? 'admin@golf.test',
    password: process.env.GT_ADMIN_PASSWORD ?? 'Admin123!',
    json: false
  };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--course-id') args.courseId = argv[++i];
    else if (a === '--api-base') args.apiBase = argv[++i];
    else if (a === '--email') args.email = argv[++i];
    else if (a === '--password') args.password = argv[++i];
    else if (a === '--json') args.json = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.dump || args.dump.startsWith('--')) {
    throw new Error('Usage: node assign.mjs greens.<courseId>.json [--course-id <id>] [--json]');
  }
  return args;
}

function readJson(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`${path} not found`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${path} is not valid JSON`);
  }
}

const args = parseArgs(process.argv);
const data = readJson(args.dump);
if (!data.unassigned) {
  throw new Error(
    `${args.dump} has no "unassigned" block — this file is already matched; use preview.mjs + import-greens.mjs --from-json.`
  );
}
const { holeWays = [], greens = [], tees = [] } = data.unassigned;

const api = createApi(args.apiBase);
await api.login(args.email, args.password);
const course = await api.getCourse(args.courseId ?? data.courseId);
console.log(`Course: ${course.clubName} / ${course.courseName} (${course.holeCount} holes)`);
console.log(`Unassigned: ${holeWays.length} hole way(s), ${greens.length} green(s), ${tees.length} tee(s)`);

const rows = course.holes.map((hole) => {
  const L = hole.length;
  if (!Number.isFinite(L) || L <= 0) {
    return { hole: hole.holeNumber, par: hole.par, note: 'no length — cannot rank' };
  }
  const candidates = greens
    .map((g) => {
      const gc = centroid(g.points);
      const tee = pickTee({ tees, greenCenter: gc, holeLengthM: L });
      return tee?.point
        ? { greenId: g.id, greenCenter: gc, teeId: tee.teeId, teePoint: tee.point, distanceM: tee.distanceM, errorM: Math.abs(tee.distanceM - L) }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.errorM - b.errorM)
    .slice(0, 3);
  const wayEnds = holeWays
    .filter((w) => Number(w.ref) === hole.holeNumber && w.points.length >= 2)
    .map((w) => w.points[w.points.length - 1]);
  return { hole: hole.holeNumber, par: hole.par, lengthM: L, candidates, wayEnds };
});

// Chain hint: best candidate's green → next hole's best candidate tee.
for (let i = 0; i < rows.length; i++) {
  const cur = rows[i].candidates?.[0];
  const next = rows[i + 1]?.candidates?.[0];
  if (cur && next) rows[i].chainToNextM = Math.round(haversineMeters(cur.greenCenter, next.teePoint));
}

if (args.json) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.table(
    rows.map((r) => ({
      hole: r.hole,
      par: r.par,
      lengthM: r.lengthM ?? r.note,
      best: r.candidates?.[0]?.greenId ?? '-',
      errM: r.candidates?.[0]?.errorM ?? '-',
      '2nd': r.candidates?.[1]?.greenId ?? '-',
      '2nd errM': r.candidates?.[1]?.errorM ?? '-',
      ways: r.wayEnds?.length ?? 0,
      chainM: r.chainToNextM ?? '-'
    }))
  );
  console.log('Assign a hole when best errM < 10 and the runner-up is > 25 worse; otherwise check the banguide/overview snap.');
}
```

- [ ] **Step 2: Smoke (no backend needed for these)**

```bash
cd tools/course-geometry
node assign.mjs                       # usage error, exit 1
node assign.mjs /nonexistent.json     # "/nonexistent.json not found", exit 1
printf '{"courseId":"x","holes":[]}' > /tmp/matched.json 2>/dev/null || true
node assign.mjs /tmp/matched.json     # 'no "unassigned" block' error, exit 1
```
(Use the scratchpad instead of /tmp if sandboxing complains: /private/tmp/claude-501/-Users-williamlanhage-GolfTrainer/65617395-dbd5-4982-a8b4-99915abd6a0a/scratchpad)

- [ ] **Step 3: `npm test` → 37.**

- [ ] **Step 4: Commit**

```bash
git add tools/course-geometry/assign.mjs
git commit -m "feat(tools): assign CLI - ranked hole/green candidates from scorecard"
```

---

### Task 5: README rung B upgrade

**Files:**
- Modify: `tools/course-geometry/README.md`

- [ ] **Step 1: Update the flags/behavior notes**

- In the Usage section's numbered bash block comments, no change needed; below the flags table add one line to the existing `--refetch` paragraph: "Imported holes also get a `teePoint` when OSM tees + scorecard lengths identify one (the report shows `tee: yes/no`)."

- [ ] **Step 2: Rewrite rung B** in "Tracing & assignment (no OSM data)" — replace the current **B.** paragraph with:

```markdown
**B. Multi-course club, duplicate refs** (`greens.<courseId>.json` has an
`unassigned` block with all raw hole ways, greens and tees): do NOT trace —
the OSM polygons are better than hand-traced ones; only the numbering is
ambiguous. Run the arithmetic first:

```bash
node assign.mjs greens.<courseId>.json
```

For each hole it ranks green candidates by how well the best-fitting tee
matches the scorecard length (`errM`), plus a routing hint (`chainM`: best
green → next hole's best tee). Assign a hole when the best `errM` is < 10 m
and the runner-up is > 25 m worse; for the rest, consult the club's
**banguide** (club website, web-search "<klubb> banguide", Caddee) and the
`--overview` snap. Build `holes` entries in the JSON by copying polygons
from `unassigned.greens` (set `holeNumber`, `status: "matched"`, `polygon`,
optionally `teePoint` from the assign output, and `source:
"assign:errM=<n>"` or `"banguide:<url>"`). Then preview + import with
`--from-json`.
```

- [ ] **Step 3: Sanity-check fences** (the README now has one more bash block — count `^```` lines, must be even) and that claims match the code (assign.mjs flags, teePoint import behavior, dump now containing tees).

- [ ] **Step 4: Commit**

```bash
git add tools/course-geometry/README.md
git commit -m "docs(tools): assignment arithmetic in README rung B"
```

---

### Task 6: Live verification — the real Albatross import (kept, not throwaway)

**Files:** none (fix-up commits only if bugs surface). Needs local stack (Docker `golftrainer-db`, backend on :3000, seeded admin — check if already running first).

- [ ] **Step 1: Scorecard research.** Find Albatross GK on Caddee (`caddee.se/klubb/<slug>` — search for the right slug) or the club site (albatross.se or similar — verify). Extract per-hole par, length (meters, pick the men's/gul tee to match a teeName like "Gul"), hcpIndex for BOTH courses (18-hålsbanan "Albatrossen"? verify actual names; the 9-hole course may be listed as 18 identical-nines on Caddee — take holes 1–9 with odd stroke indices per the known rule). Record the source URL.
- [ ] **Step 2: Create both courses for real** via the three REST calls (`clubName: "Albatross Golfklubb"`, courseName per research, `teeName: "Gul"` or per scorecard, holeCount 18 resp. 9) and PATCH par/length/hcpIndex per hole from the scorecard.
- [ ] **Step 3: Dump.** `node import-greens.mjs --course-id <18-id> --club "Albatross" --dry-run` → expect case B (duplicate refs), exit 1, dump with ~38 hole ways / ~34 greens / ~54 tees.
- [ ] **Step 4: Assign.** `node assign.mjs greens.<18-id>.json` — resolve the 18-hole course using errM/chainM; consult the club's banguide online for confirmation where the arithmetic is not clear-cut; also snap `--club "Albatross" --overview` for visual cross-checks. Build the 18 `holes` entries (polygon + teePoint + source). Repeat the dump+assign for the 9-hole course id (same dump data, its own greens JSON — copy the file to greens.<9-id>.json and edit; set `courseId` accordingly).
- [ ] **Step 5: Preview + import both courses.** Inspect every preview PNG (polygon on a green). `import-greens.mjs --from-json` per course. Expect exit 0 with all rows imported (report `tee: yes` where assigned). Record any holes left unresolved and why.
- [ ] **Step 6: DB verification.** GET both courses: every imported hole has greenPolygon ≥ 3 pts; where teePoint is set, `layout.derived.hole_length_meters` is within ~15 % of the scorecard length. Spot-check 3 holes per course in admin-web HoleManager if the frontend is running.
- [ ] **Step 7: Wrap-up.** Courses are KEPT. `npm test` → 37. `git status` clean apart from ignored artifacts + AGENTS.md. Report the full per-hole outcome table and every evidence source used.
