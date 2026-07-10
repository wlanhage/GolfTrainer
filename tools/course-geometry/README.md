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
nearly equidistant — the entry carries `secondGreenId`/`secondDistanceM`, or
`reason: "shared-green"` when two holes claimed the same green, which usually
means a reversed hole way in OSM — resolve by eye), `unmatched` (no green
within 80 m), `no-hole-way`, `duplicate-hole-ways`.

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
contributors" attribution on the satellite map styles (webbapp `mapStyle.ts`
+ the compact attribution control in its map components, admin-web
`HoleManager.tsx`).
