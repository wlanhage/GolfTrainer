# Agent green tracing & assignment fallback — design

**Date:** 2026-07-10
**Status:** Approved (follow-up to `2026-07-10-green-polygon-import-design.md`)

## Goal

Make the no-OSM-data fallback practical and mostly automatic. When
`import-greens.mjs` cannot resolve a hole from OSM, the agent should be able
to *look at the satellite map* and produce the green polygon itself — with
mechanical tooling for georeferencing and coordinate conversion, and a
research-first procedure (club course guides, "banguider") for determining
hole numbering, so the user is only consulted as a last resort.

## Background

The OSM import (already shipped in `tools/course-geometry/`) leaves three
gap cases, observed in the E2E run:

| Case | Example | What exists in OSM |
|------|---------|--------------------|
| A. Hole way exists, green missing | Söderslätts GK (9 ways, 0 greens) | `golf=hole` way with `ref` → we know *where* and *which hole* |
| B. Multi-course club as one polygon | Vasatorps GK (57 ways, 63 greens, dup refs) | greens exist, but hole↔green assignment is ambiguous across courses |
| C. Nothing at all | Hofgårds GK | only (at most) the `leisure=golf_course` polygon |

Key insight from iteration: **case B needs assignment, not tracing** — the
OSM polygons are better than hand-traced ones; only the numbering is
ambiguous. Tracing is for cases A and C.

The agent has already demonstrated it can read Esri tiles visually (preview
verification in the E2E run). What's missing is mechanical: georeferenced
snapshots, pixel→lat/lng conversion, and a documented numbering procedure.

## Components

All in `tools/course-geometry/`, zero new dependencies (Playwright reused
from `../pr-screenshots` as before).

### 1. `lib/georef.mjs` (new, pure, unit-tested)

- `makeGeoref({center|bboxCorners, zoom, grid})` → `{zoom, originX, originY, widthPx, heightPx}` where origin is the world-pixel of the snapshot's top-left corner (tile-aligned).
- `pixelsToPolygon(georef, "x,y x,y ...")` → `[{lat,lng}...]` via existing `worldPixelToLngLat`; throws on malformed input.
- `parseMarks("A:x,y B:x,y")` → `[{label, x, y}]`.

### 2. `lib/tiles.mjs` (new; extraction, not invention)

- `tileGridHtml(georef)` → the absolutely-positioned Esri `<img>` grid HTML (extracted from `preview.mjs`, which is refactored to use it — behavior unchanged, suite stays green).
- `renderHtmlToPng(html, outPath)` → Playwright body-screenshot wrapper (also extracted).

### 3. `snap.mjs` (new CLI) — georeferenced satellite snapshots

```
node snap.mjs --center <lat,lng> [--zoom 19] [--grid 3] [--name <n>]
node snap.mjs --club "<klubb>" --overview [--zoom 16]
```

- `--center`: stitches a grid×grid tile area around the point.
- `--club --overview`: queries Overpass for the club's `leisure=golf_course`
  polygon (works even when holes/greens are unmapped), computes its bbox,
  picks a zoom that fits (cap ~2500 px on the long side), renders the whole
  course.
- Output: `snap.<name>.png` + sidecar `snap.<name>.json` (the georef). Both
  gitignored (extend the existing `.gitignore` block).
- `--zoom` doubles as the workaround for Esri's missing z19 imagery.

### 4. `trace.mjs` (new CLI) — agent eyes → database coordinates

```
node trace.mjs snap.<name>.json --hole 7 --points "x,y x,y ..." --into greens.<courseId>.json
node trace.mjs snap.<name>.json --mark "A:x,y B:x,y" [--out marked.png]
```

- `--points`: converts via `pixelsToPolygon`, validates with the existing
  `validateGreen` (area 150–1500 m², ring), and inserts/replaces the hole's
  entry in the greens JSON as `{holeNumber, status: 'matched', polygon,
  source: 'traced'}`. Refuses (with the reasons) when validation fails.
- `--mark`: renders letter markers on the snapshot (SVG overlay via
  `lib/tiles.mjs`) for the ask-the-user numbering fallback.
- After tracing: the normal `preview.mjs` + `import-greens.mjs --from-json`
  pipeline applies unchanged.

### 5. `lib/match.mjs` — carry the camera target

Unmatched holes that *do* have a hole way get `lookAt: {lat,lng}` (the way's
last point) in their result entry, so the agent knows exactly where to point
`snap.mjs --center` without re-querying Overpass.

### 6. `import-greens.mjs` — dump raw data on ambiguity

On the duplicate-refs stop (case B), still write `greens.<courseId>.json`,
with `holes: []` plus a new top-level `unassigned` key:

```json
{ "courseId": "...", "club": "...", "holes": [],
  "unassigned": { "holeWays": [{ "ref": "1", "points": [...] }, ...],
                  "greens": [{ "id": "way/123", "points": [...] }, ...] } }
```

The agent assigns greens to holes by editing `holes` entries (copying
polygons from `unassigned.greens`, guided by the club's banguide), then
imports with `--from-json`. `unassigned` is ignored by the import loop.

## Agent numbering procedure (docs, not code)

README's fallback section becomes a ladder — never guess:

1. **Case A (`lookAt` present):** `snap.mjs --center <lookAt>` → trace by eye
   → `trace.mjs --points` → `preview.mjs` → `import --from-json`. Numbering
   comes free from the OSM `ref`.
2. **Case B (dup refs, `unassigned` dump):** research the club's **banguide**
   (club website, "\<klubb\> banguide", Caddee) — per-hole aerial images give
   the routing per course. Match fairway/bunker shapes against an
   `--overview` snapshot, assign `unassigned.greens` to hole numbers in the
   JSON. No tracing — OSM polygons are reused. Record the source used in the
   final report.
3. **Case C (nothing in OSM):** `snap.mjs --club --overview` + banguide
   research to locate and number greens; trace each via `--center` snaps.
4. **Banguide not found or not matchable:** `trace.mjs --mark` letter map →
   ask the user for the letter→hole mapping. One short question per course.
5. A green the agent cannot see clearly (shadow, tree cover, missing
   imagery at every zoom) stays unresolved and is reported.

## Error handling

- `snap.mjs --club` with no `golf_course` match: list what Overpass returned, exit 1.
- `trace.mjs` refuses polygons failing `validateGreen` and prints the reasons; `--into` a missing/corrupt JSON is a clear error, not a crash.
- All artifacts (`snap.*`, `marked.png`) land in the tool dir and are gitignored.

## Testing

- Unit: `lib/georef.mjs` (origin math, `pixelsToPolygon` round-trip against `lngLatToWorldPixel`, malformed input), `parseMarks`; existing suite stays green after the `preview.mjs` refactor and `match.mjs` `lookAt` addition.
- Live verification: Söderslätts GK (real case A from the E2E run) — snap at two holes' `lookAt`, trace both greens by eye, preview, dry-run import into a throwaway local course; exercise the case-B dump on Vasatorp (JSON contains `unassigned` with 57 ways/63 greens); attempt one banguide lookup to validate the research step.

## Non-goals (deferred)

- Auto-segmentation (flood-fill from a seed point) — v2 if manual tracing
  proves too slow or imprecise; the current bottleneck is locating/numbering,
  not vertex entry.
- Contributing traced polygons back to OSM.
- Mobile attribution (separate task chip) and any backend changes.
