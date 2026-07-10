# Green polygon import — design

**Date:** 2026-07-10
**Status:** Approved (scope: greens only)

## Goal

Let an agent (Claude) paint hole geometry automatically instead of the admin
hand-drawing it in admin-web's HoleManager. Scope is **green polygons only** —
tees, bunkers, fairways and OB stay manual. The end state: the user says
*"måla upp hålen för \<klubb / bana\>"* and gets green polygons imported,
validated, and visually verifiable, with a report of any holes that could not
be resolved automatically.

## Background / key facts

- The backend already supports scripted geometry:
  `PATCH /api/v1/courses/:id/holes/:holeNumber/layout` (admin-only) with
  `{ geometry: { teePoint, greenPolygon, bunkerPolygons, treesPolygons, obPolygons, fairwayPolygon? } }`
  (`backend/src/modules/courses/courses.routes.ts`,
  `backend/src/modules/courses/courses.schema.ts`). Coordinates are
  `{lat, lng}` arrays. No backend changes are needed.
- The PATCH **replaces the entire geometry** and the server recomputes derived
  fields (`layoutStatus`, bearing, length, centerline) from it
  (`courses.service.ts#updateHoleLayout`). The course detail endpoint returns
  each hole's full `layout.geometry`, so existing geometry can be read and
  merged before writing.
- OpenStreetMap has ~3,850 `golf=green` polygons in Sweden (≈ half of all
  holes), plus `golf=hole` ways tagged `ref=<hole number>` that end at/near the
  green — verified via Overpass API 2026-07-10 (spot check: Vasatorps GK, 57
  hole ways with refs, 63 greens).
- admin-web renders on free Esri World Imagery tiles
  (`services.arcgisonline.com/.../World_Imagery`). The same tiles serve as the
  visual-verification background and the agent's fallback tracing source.
- `tools/pr-screenshots/` already has Playwright — reused for rendering
  preview images; no new dependencies anywhere.

## Architecture

New tool directory: `tools/course-geometry/`

| File | Purpose |
|------|---------|
| `import-greens.mjs` | CLI: fetch from OSM → match → validate → import via API |
| `preview.mjs` | Render one PNG per hole (Esri tile + polygon overlay) for review |
| `README.md` | Usage + the agent workflow (including fallback procedure) |

`import-greens.mjs` interface:

```
node import-greens.mjs \
  --course-id <cuid>            # required; course must already exist in DB
  --club "Vasatorps GK"         # OSM search name for the golf_course polygon
  [--course "TC"]               # narrows to one course at multi-course clubs
  [--api-base http://localhost:3000]
  [--email admin@golf.test --password Admin123!]   # or env vars
  [--dry-run]                   # default: fetch+match+validate+write geometry JSON, no PATCH
  [--force]                     # allow overwriting a non-empty existing greenPolygon
```

Plain Node ≥18 (built-in `fetch`), no dependencies.

## Data flow

1. **Resolve course** — `GET /api/v1/courses/:id` for `holeCount` and each
   hole's existing `layout.geometry`.
2. **Fetch OSM** — Overpass query: find the `leisure=golf_course`
   way/relation matching `--club` (and `--course` if given), `map_to_area`,
   then fetch `golf=hole` and `golf=green` ways with full node geometry
   inside it.
3. **Match** — for each hole number 1..N: take the `golf=hole` way with
   `ref=N`; its green is the `golf=green` polygon whose centroid is nearest
   the hole way's last node, within 80 m. Unmatched holes are reported, never
   guessed.
4. **Validate** — per green: polygon area within 150–1,500 m², ≥ 4 vertices,
   closed/ordered the same way HoleManager saves polygons (verify against one
   hand-drawn hole in the local DB before finalizing the converter). Per
   course: every hole 1..N accounted for (matched or explicitly reported).
5. **Import** — login as admin (`POST /api/v1/auth/login`), then per hole:
   read existing geometry, replace **only** `greenPolygon`, keep every other
   field verbatim, and PATCH the merged object. If the hole already has a
   non-empty `greenPolygon`, skip with a warning unless `--force`.
6. **Preview** — `preview.mjs` writes one PNG per hole: Esri tile crop at
   zoom ~18–19 centered on the green with the polygon drawn on top (rendered
   via a generated HTML page + the Playwright install in
   `tools/pr-screenshots/`). The agent inspects these itself and shares them
   with the user.

Intermediate artifact between steps 2–5: a `greens.<course-id>.json` file
(hole number → polygon + match metadata), so the agent can hand-edit it in the
fallback flow and re-run validate/import without re-fetching.

## Fallback when OSM has no green (agent procedure, not code)

Documented in the README as the agent workflow:

1. If the hole has a `golf=hole` way but no matching green: the agent fetches
   Esri tiles (z19 ≈ 0.17 m/px in southern/central Sweden) around the hole
   way's end point, visually traces the green outline, converts pixel →
   lat/lng with Web Mercator math, and writes the polygon into the
   intermediate JSON. Validation and import then run as normal.
2. If there is no hole way either: the agent reports the hole as unresolved
   and asks the user for an approximate location. Never guess.

## Error handling

- Overpass down/timeout: retry once against a mirror
  (`overpass.kumi.systems`), then fail with a clear message — no partial
  imports without saying so.
- Multi-course clubs where `--course` doesn't isolate one polygon: list the
  candidate OSM course names/ids and stop.
- Ambiguous match (two greens within 80 m of a hole end): flag for the agent
  to resolve visually via previews rather than picking silently.
- Every run ends with a per-hole summary table: `imported | skipped
  (existing) | unmatched | failed validation`.

## Licensing

OSM data is ODbL. Add "© OpenStreetMap contributors" to the map attribution
strings in admin-web (HoleManager map) and webbapp's map view, alongside the
existing Esri attribution. One-line change in each.

## Documentation

Short section in `CLAUDE.md` ("Painting greens / hole geometry") pointing to
`tools/course-geometry/README.md`, so any future session executes the flow on
request.

## Testing

- Dry-run + import against the local seeded DB for one well-mapped club;
  verify greens land correctly by inspecting the generated previews and the
  HoleManager view.
- Verify the merge-safety rule: hand-draw geometry on one hole, run import
  without `--force`, confirm the hole is skipped and untouched; with
  `--force`, confirm only `greenPolygon` changed.
- Verify a 9-hole course and a multi-course club (e.g. Vasatorp) resolve
  correctly.

## Non-goals

- Importing tees, bunkers, fairways, trees or OB (schema supports it; deferred).
- Editing or contributing back to OSM.
- Any mobile/webbapp feature changes beyond the attribution line.
- Automatic course *creation* — that flow already exists (three REST calls,
  see agent memory / CLAUDE.md).
