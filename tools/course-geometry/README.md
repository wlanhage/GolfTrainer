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

Re-running the OSM fetch refuses to overwrite a greens JSON containing
hand-traced/assigned entries unless `--refetch` is given. Imported holes also
get a `teePoint` when OSM tees + scorecard lengths identify one (the report
shows `tee: yes/no`).

Hole statuses in `greens.<courseId>.json`: `matched`, `ambiguous` (two greens
nearly equidistant — the entry carries `secondGreenId`/`secondDistanceM`, or
`reason: "shared-green"` when two holes claimed the same green, which usually
means a reversed hole way in OSM — resolve by eye), `unmatched` (no green
within 80 m — the entry carries `lookAt`, the hole way's end point, for the tracing workflow), `no-hole-way`, `duplicate-hole-ways`.

Report actions beyond those statuses: `imported`, `would-import` (dry-run),
`skipped-existing` (green already in DB, use `--force`), `failed-validation`,
`missing-polygon` (status says matched but no polygon field), `not-in-json`
(hole absent from an edited file), `failed` (PATCH or entry error),
`no-such-hole-in-db`.

## Agent workflow ("måla upp hålen för <klubb>")

1. Find the course: `GET /api/v1/courses?search=<name>`. Create it first via
   the three REST calls in CLAUDE.md if it does not exist.
2. Run the dry-run. For multi-course clubs, expect the duplicate-refs error,
   pick the right candidate name, re-run with `--course`. Note: some Swedish
   clubs (e.g. Vasatorp) are mapped in OSM as a single club polygon with
   unnamed hole ways for all their courses — then `--course` cannot separate
   them and the tool refuses with duplicate-hole-ways for every hole. Those
   clubs need the manual `--from-json` workflow (or improved OSM data).
3. Render previews and inspect every PNG — the polygon must sit on the green
   surface, not on a fringe, bunker or the wrong green. If tiles show "Map
   data not yet available", Esri simply lacks zoom-19 imagery there — that is
   the tile source, not a polygon error — check the spot in admin-web's
   HoleManager instead (zoom out manually until imagery renders).
4. For `ambiguous`/`unmatched` holes, or when a dump/skeleton file was
   written, follow **Tracing & assignment (no OSM data)** below.
5. Import, then share the per-hole report and the previews with the user.

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
`unassigned` block with all raw hole ways, greens and tees): do NOT trace —
the OSM polygons are better than hand-traced ones; only the numbering is
ambiguous. Run the arithmetic first:

```bash
node assign.mjs greens.<courseId>.json
```

For each hole it ranks green candidates by how well the best-fitting tee
matches the scorecard length (`errM`), plus a routing hint (`chainM`: best
green → next hole's best tee). The `tee` column shows the tee-pick verdict
(`ambiguous-tees` means confirm the tee visually before importing it), and a
`*` on a green id means it is the best candidate for more than one hole —
resolve those together. Heads-up for clubs whose OSM course polygons overlap (e.g. Albatross): the dump pools every course's tees and greens, so `errM` ties across many holes — expect the arithmetic to auto-resolve only holes with unique refs or clear length separation, and lean on `chainM`, per-way endpoint proximity (`ways` column, `wayEnds` in `--json`), and the banguide for the rest. Assign a hole when the best `errM` is < 10 m
and the runner-up is > 25 m worse; for the rest, consult the club's
**banguide** (club website, web-search "<klubb> banguide", Caddee) and the
`--overview` snap. Build `holes` entries in the JSON by copying polygons
from `unassigned.greens` (set `holeNumber`, `status: "matched"`, `polygon`,
optionally `teePoint` from the assign output, and `source:
"assign:errM=<n>"` or `"banguide:<url>"`). Then preview + import with
`--from-json`.

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

## Licensing

Green geometry sourced from OSM is ODbL — keep the "Data © OpenStreetMap
contributors" attribution on the satellite map styles (webbapp `mapStyle.ts`
+ the compact attribution control in its map components, admin-web
`HoleManager.tsx`).
