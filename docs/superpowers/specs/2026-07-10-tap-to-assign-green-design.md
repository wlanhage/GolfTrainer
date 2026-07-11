# Tap-to-assign green — design

**Date:** 2026-07-10
**Status:** Approved (steg 3 of the green-automation roadmap; follows
`2026-07-10-tee-assignment-design.md`)

## Goal

Let a player standing on the tee resolve which green belongs to the hole
they are playing, by tapping it on the map — closing the last gap the OSM
import, arithmetic and banguide research cannot: holes with two genuinely
tied green candidates (the 6 unresolved Albatross holes are the first data).
The player's reward is immediate (distance-to-green appears); the marking
work is a side effect they never asked for, so the flow must never feel like
a chore. One valid confirmation locks the green; admins can still correct it
in HoleManager.

## Core UX principles (these constrain every decision below)

1. **Reward, not duty.** The only reason a player taps is to *get* something
   — distance to green — so the prompt sells that, not the data collection.
   The distance line lights up the instant they confirm.
2. **Two or three candidates per hole, never a map full of shapes.** The
   import already knows *which* greens were tied *per hole*. Each candidate
   carries the hole numbers it is a candidate for; the play view for hole N
   shows only that hole's candidates.
3. **Never blocking.** No modal on hole open. A discreet banner + marked
   candidates. Ignore it and everything works exactly as today (no distance).
4. **Every candidate green is clearly, unmistakably marked** (the user's
   explicit requirement — see Rendering below). Greens on satellite imagery
   are themselves green, so markers must not rely on green and must not be
   faint outlines that blend into grass.
5. **Self-healing, and single-candidate degrades to yes/no.** Confirming
   green A for hole 3 removes it from hole 5's candidate list; often only one
   candidate remains for hole 5. With two candidates the view asks "tap the
   one you're playing toward"; with exactly one it reads as "Är detta din
   green? Ja / Nej" — same UI, no extra machinery. We deliberately do **not**
   auto-guess a single green and ask yes/no when multiple candidates exist:
   these holes are unresolved precisely because the arithmetic couldn't
   distinguish the greens (~50/50), so a coin-flip yes/no would train players
   to rubber-stamp wrong data. The player's eyes (they can see which green
   they aim at) are the high-confidence signal, not a guess.
6. **Zero noise for finished courses.** Holes that already have a green never
   show any of this.

## Data model

New Prisma model in `prisma/schema.prisma`:

```prisma
enum GreenCandidateStatus {
  OPEN
  ASSIGNED
}

model GreenCandidate {
  id                 String               @id @default(cuid())
  courseId           String
  polygon            Json                 // GeoPoint[] open ring, {lat,lng}
  forHoles           Int[]                // hole numbers this green is a candidate for
  source             String               // e.g. "assign-tie", "traced", "osm-unassigned"
  status             GreenCandidateStatus @default(OPEN)
  assignedHoleNumber Int?
  confirmedByUserId  String?
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt

  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@index([courseId, status])
}
```

`Course` gains `greenCandidates GreenCandidate[]`. Migration via the repo's
prisma workflow (`prisma:migrate:dev:local`).

## Backend (module `courses`, following the existing repo/service/controller/routes/schema split)

### GET `/api/v1/courses/:id/green-candidates` (any authenticated user)

Returns OPEN candidates for the course, each `{ id, polygon, forHoles }`,
**filtered** so a candidate whose every `forHoles` entry already has a green
in the DB is omitted (nothing to resolve). Players fetch this alongside the
course when entering play.

### POST `/api/v1/courses/:id/holes/:holeNumber/confirm-green` (any authenticated user)

Body `{ candidateId }`. In a single transaction:

1. Load the hole + its layout and the candidate `FOR UPDATE`.
2. **Reject with 409** if: the hole already has a `greenPolygon` (≥3 pts);
   the candidate is not `OPEN`; or `holeNumber` is not in the candidate's
   `forHoles`. The 409 body says which (`already-assigned` / `candidate-taken`
   / `not-a-candidate`).
3. Otherwise: write the candidate's polygon as the hole's `greenPolygon`
   using the **existing merge-safe layout path** (preserves teePoint,
   fairways, bunkers, etc.; recomputes derived length/bearing/centerline),
   set the candidate `ASSIGNED` with `assignedHoleNumber = holeNumber` and
   `confirmedByUserId = <caller>`.
4. Return the updated hole layout (same shape the play view already consumes),
   so the client updates the map without a reload.

The 409-on-existing-green rule **is** the lock: the first valid confirmation
wins; players can never overwrite. Admin correction stays in HoleManager,
which rewrites layout freely and is unaffected.

Zod schemas + a `requireAuth` preHandler (not `requireAdmin` — this is a
player action). Reuse the existing `updateHoleLayout` service internals for
the merge-safe write rather than duplicating geometry handling.

## Import tooling

`tools/course-geometry/` gains a way to publish candidates. Simplest: a new
`--as-candidates` mode on a small script (or import-greens flag) that reads a
greens JSON's `unassigned.greens` (plus any per-hole tie info the agent
recorded) and POSTs them as OPEN candidates with `forHoles` set from the
ambiguity. For the Albatross data specifically, the agent sets `forHoles` to
the tied hole numbers per candidate. Admin auth for the POST is fine (the
importer already logs in as admin).

## Webbapp play view (`HolePlayMap.tsx` + its container)

- The container fetches open candidates for the course and passes to the play
  view the candidates whose `forHoles` includes the active hole — **only when
  the active hole has no green yet**.
- **Rendering (the "clearly marked" requirement):** each candidate green is
  drawn as: a bright **non-green** high-contrast outline (white/amber, ~3px),
  a semi-transparent fill (so the actual green surface shows through for the
  player to verify), and a **solid center pin** marker that is the tap target
  (≥44px hit area). Multiple candidates each get the identical treatment and
  are distinguished by position, not labels — the player taps the one they are
  walking toward. Markers sit above all map layers and read on any imagery.
- A discreet banner under the map: "Vilken green spelar du mot? Tryck på den
  så får du avstånd" — dismissible, never a modal.
- **Tap** → the tapped candidate highlights (teal), the others dim → a
  **bottom sheet** slides up showing "Ca {n} m från dig" (doubles as a
  sanity check the player can eyeball) and buttons "Avbryt" / "Ja, detta är
  green {N}". The lock is mentioned in half a line, not scary legalese.
- **GPS soft check:** if the player's position is known and > ~600 m from the
  tapped candidate, show "Du verkar inte vara vid banan" above the confirm
  button — a warning, never a hard block (no GPS on desktop).
- **Confirm** → POST → on success, replace the candidate layer with the real
  green from the response and light the distance line immediately. On 409
  (race), silently render the now-assigned green and drop the banner — from
  the player's view the hole simply became done.

## Testing

- Backend unit/integration: confirm-green happy path (green written, candidate
  ASSIGNED, confirmedBy recorded, derived recomputed); 409 on existing green;
  409 on already-ASSIGNED candidate; 409 when holeNumber ∉ forHoles; GET
  filters ASSIGNED and fully-resolved candidates; cascade delete with course.
- Import `--as-candidates` posts OPEN candidates with correct forHoles.
- Live: publish the 6 tied Albatross candidates, confirm two via the API and
  two via the running webbapp, verify greens land and candidates flip ASSIGNED.
- PR screenshots of the play view (banner + marked candidates + bottom sheet)
  per CLAUDE.md, since this is a visual change.

## Error handling

- confirm-green returns typed 409s; the play view handles each gracefully
  (race → show assigned green; not-a-candidate → refetch).
- GET never returns candidates for holes already resolved.
- A candidate referencing a hole number outside 1..holeCount is ignored by
  the play view and flagged by the import step.

## Non-goals (deferred)

- Tees in the tap flow (greens only).
- Mobile UI — same endpoints, wired later.
- Voting / multi-confirmation / edit history beyond `confirmedByUserId`
  (single confirmation locks, per the approved trust model).
- Any admin UI beyond the existing HoleManager override.
