# Tees & constraint-based hole assignment — design

**Date:** 2026-07-10
**Status:** Approved (steg 2 of the green-automation roadmap; follows
`2026-07-10-agent-green-tracing-design.md`)

## Goal

Two things, which together make most "case B" clubs (all data present, hole
numbering ambiguous — e.g. Vasatorp, Albatross) importable without user
involvement:

1. **Tees:** fetch `golf=tee` from OSM, pick the right tee per hole using the
   scorecard length, and import it as the hole's `teePoint` (the backend then
   derives hole length, bearing and centerline automatically).
2. **Assignment support:** a distance-matrix helper that turns the
   `unassigned` dump + the course's DB lengths into ranked, machine-checkable
   assignment candidates, so the agent resolves numbering with arithmetic +
   banguide confirmation instead of eyeballing.

Verification target is a real deliverable: **Albatross GK** (18-hålsbanan
"Albatrossen" + 9-hålsbanan) imported for real — courses created from the
Caddee scorecard, greens + tees assigned and imported.

## Background facts (verified live)

- Albatross in OSM: 2 `golf_course` polygons, 38 hole ways (18 + 9 + extra,
  duplicate refs → case B), 34 greens, **54 tees**. Tees exist in OSM as ways
  *and* nodes.
- The current Overpass query only fetches `golf=hole` + `golf=green` ways.
- `PATCH .../layout` accepts `teePoint` (nullable point); when both teePoint
  and greenPolygon are present the backend computes `holeLengthMeters`,
  `holeBearing`, `teeToGreenCenterline` (courses.service.ts).
- Scorecard length is measured along the play line: straight-line tee→green
  is *at most* the scorecard length, typically 0–15 % shorter on doglegs.
- Caddee (`caddee.se/klubb/<slug>`, `__NEXT_DATA__`) is the trusted scorecard
  source; 9-hole courses are listed as 18 (same nine twice, odd stroke
  indices are the real ones).

## Components

### 1. `lib/osm.mjs` — fetch tees

`buildOverpassQuery` also fetches `way(area.c)["golf"="tee"]` and
`node(area.c)["golf"="tee"]`. `parseOverpass` returns a new `tees` array:
`[{ id, point: {lat,lng}, ref?, name? }]` — for ways, `point` is the centroid
of the way's geometry; for nodes, the node position. `ref`/`name` carry the
OSM tags when present (tee colour/number hints).

### 2. `lib/match.mjs` — tee selection for matched holes

New export `pickTee({ tees, greenCenter, holeLengthM })`:
- Candidates: tees whose distance to `greenCenter` is within
  `[0.75 × holeLengthM, 1.05 × holeLengthM]` (dogleg band; scorecard length
  is an upper bound plus small measurement slack).
- Pick the candidate whose distance is **closest to** `holeLengthM`.
- Returns `{ point, distanceM, teeId }` or `null` (no candidate in band).
- Never guesses between near-ties: if two candidates' length errors differ by
  less than 15 m AND the tees are more than 30 m apart from each other,
  return `{ reason: 'ambiguous-tees' }` (no point) — the agent resolves
  visually. (Two pads close together = same tee area; either is fine.)

`matchGreens` gains an optional `tees` + `holeLengths` input (map hole → m).
Matched entries gain `teePoint` (from `pickTee`) when resolvable, plus
`teeDistanceM`. Absence of tees/lengths keeps today's behavior exactly
(back-compat: all existing tests unchanged).

### 3. `import-greens.mjs` — import teePoint, dump tees

- The merge-safe PATCH sets `teePoint: e.teePoint ?? existing.teePoint`
  (imported tee only when the entry carries one; never null-overwrites an
  existing tee; `--force` semantics unchanged — green + tee both rewritten
  from the entry when forced, but a missing `e.teePoint` still preserves the
  existing one).
- Hole lengths for `pickTee` come from the course the CLI already GETs
  (`holes[].length`).
- The `unassigned` dump (case B / no-hole-ways) gains `tees: osm.tees`.
- Report rows show `tee: yes/no` per imported hole.

### 4. `assign.mjs` (new CLI) — the arithmetic the agent needs

```
node assign.mjs greens.<courseId>.json [--api-base ...] [--course-id <id>]
```

Reads the dump's `unassigned` block plus the course's holes (number, par,
length) from the API, and prints, per hole:

- the hole way candidates with that ref (endpoints), when hole ways exist;
- ranked green candidates: for each green, the best-fitting tee
  (via `pickTee` against the hole's length) and the length error
  `|distance − scorecard|`, sorted by error;
- a chain hint: distance from each green candidate to the nearest tee
  candidate of the *next* hole (course-routing signal).

Output is a compact table (and `--json` for machine reading). It does NOT
write assignments — the agent copies its conclusions into the greens JSON
(status `matched`, `source: "assign:<evidence>"` or `banguide:<url>`), so
every assignment stays explicit and reviewable. A full auto-solver is
deferred (v2) until the matrix approach proves insufficient.

### 5. README — rung B upgrade

Rung B becomes: run `assign.mjs`, resolve each hole where one candidate's
length error is clearly best (< 10 m error AND runner-up > 25 m worse —
otherwise consult the banguide/overview snap before assigning), verify the
full set with `preview.mjs`, import. Banguide remains the tiebreaker and the
recorded evidence source.

## Testing

- Unit (all pure): `parseOverpass` tees (way centroid + node, ref passthrough);
  `pickTee` (band edges, closest-to-length pick, ambiguous-tie refusal,
  empty candidates); `matchGreens` back-compat (no tees input → identical
  output) and teePoint attachment.
- Live verification = the real Albatross import:
  1. Create both courses via REST with par/length/hcp from Caddee
     (`caddee.se/klubb/albatross-golfklubb` or the club's actual slug —
     verify against the club site; 9-hole course uses the odd-index rule).
  2. Run the importer → case B dump (with tees) → `assign.mjs` → agent
     resolves 18 + 9 holes (banguide from albatross.se as confirmation) →
     preview all → import.
  3. Verify in DB: every hole has greenPolygon ≥ 3 pts; teePoint set where
     resolved; derived `hole_length_meters` within ~15 % of scorecard.
  4. These courses are KEPT (real deliverable, not throwaway).

## Error handling

- `assign.mjs` with a JSON lacking `unassigned` → clear error pointing at
  the normal (already-matched) flow.
- Holes without DB length: listed in assign output as "no length — cannot
  rank"; `pickTee` skipped for them.
- All new outputs respect the existing artifact conventions (gitignored).

## Non-goals (deferred)

- Full constraint-solver auto-assignment (v2 — matrix + agent reasoning first).
- Tap-to-assign in-app feature (steg 3, separate spec).
- Fairways/bunkers import; mobile changes.
