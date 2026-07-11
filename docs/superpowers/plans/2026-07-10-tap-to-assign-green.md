# Tap-to-assign Green Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player tap the correct green for the hole they are playing, in the webbapp play view, locking it after one confirmation — resolving the greens the OSM import + arithmetic could not (the 6 tied Albatross holes are the first data).

**Architecture:** New `GreenCandidate` Prisma model + two player-facing endpoints in the `courses` module (`GET .../green-candidates`, `POST .../holes/:n/confirm-green`) that write the chosen polygon via the existing merge-safe layout path inside a transaction; a webbapp play-view layer that renders candidate greens with high-contrast non-green markers and a bottom-sheet confirm; a `--as-candidates` publish step in `tools/course-geometry`.

**Tech Stack:** Fastify + Prisma (Postgres) backend, Next.js + MapLibre webbapp, Node importer, `tsx --test` (backend) / `node --test` (tools).

**Spec:** `docs/superpowers/specs/2026-07-10-tap-to-assign-green-design.md`

**Grounding (verified 2026-07-10):**
- Prisma schema source: `prisma/schema.prisma` (backend `package.json` points `--schema ../prisma/schema.prisma`). Models `Course` (id, holes), `Hole` (courseId, holeNumber, `@@unique([courseId, holeNumber])`), `HoleLayout` (holeId unique, `greenPolygon Json?`, derived fields, `layoutStatus`). Migrations: `npm --prefix backend run prisma:migrate:dev:local`.
- Backend module `backend/src/modules/courses/`: `courses.{routes,controller,service,repository,schema}.ts`. Routes add `preHandler: requireAuth` globally; admin-only routes add `requireAdmin`. Player routes just need the global `requireAuth`. `request.auth.userId` is set by `requireAuth`.
- `coursesService.updateHoleLayout(id, holeNumber, geometry)` computes derived (bearing/length/centerline via `resolveGreenCenter`/`resolveBearing`/`haversineMeters`, status via `fromGeometryStatus`) then calls `coursesRepository.updateHoleLayout(holeId, data)` which `prisma.holeLayout.upsert`s. `resolveGreenCenter` averages every vertex → store OPEN rings.
- `GET /api/v1/courses/:id` maps holes via `mapHoleWithLayout` → `holes[].layout.geometry = { teePoint, greenPolygon, fairwayPolygon, fairwayPolygons, bunkerPolygons, treesPolygons, obPolygons }`.
- Backend tests: `tsx --test "src/**/*.test.ts"`, node:test, mock the repository by reassigning methods (see `backend/src/modules/clubs/clubs.service.test.ts`).
- Webbapp: play container `webbapp/src/app/play/round/[roundId]/[holeNumber]/page.tsx` holds `layout: HoleLayoutGeometry|null`, `courseId`, `playerPosition: GeoPoint|null`, renders `<HolePlayMap geometry=... holeKey=... playerPosition=... />` (dynamic, ssr:false). `HolePlayMap.tsx` builds GeoJSON FCs via `toPolygon(id, points, color, kind)` and `buildLayoutFC`. API via `useCoursesApi()` / `useApiClient().request<T>(path, opts)`.

**Cross-task types (define once, reuse):**
```ts
// backend + webbapp shared shape (not imported across packages — mirrored)
type GreenCandidateDto = { id: string; polygon: {lat:number;lng:number}[]; forHoles: number[] };
```

---

### Task 1: GreenCandidate model + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the enum + model.** After the `HoleLayout` model (around line 600) add:

```prisma
enum GreenCandidateStatus {
  OPEN
  ASSIGNED
}

model GreenCandidate {
  id                 String               @id @default(cuid())
  courseId           String
  polygon            Json
  forHoles           Int[]
  source             String
  status             GreenCandidateStatus @default(OPEN)
  assignedHoleNumber Int?
  confirmedByUserId  String?
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt

  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@index([courseId, status])
}
```

Add to `model Course` (in its relations block, after `rounds Round[]`):
```prisma
  greenCandidates GreenCandidate[]
```

- [ ] **Step 2: Migrate + generate against the local DB**

Run: `npm --prefix backend run prisma:migrate:dev:local -- --name green_candidates`
Expected: a new migration under `prisma/migrations/`, `GreenCandidate` table created, client regenerated with no error.

- [ ] **Step 3: Validate + smoke the client type**

Run: `npm --prefix backend run prisma:validate`
Expected: "The schema at ../prisma/schema.prisma is valid".
Run: `cd backend && npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.greenCandidate.count().then(n=>{console.log('count',n);return p.$disconnect()})"`
Expected: prints `count 0` (table exists, query works).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(backend): GreenCandidate model + migration"
```

---

### Task 2: Extract `buildLayoutWrite` pure helper (refactor, DRY for the confirm path)

**Files:**
- Modify: `backend/src/modules/courses/courses.service.ts`
- Test: `backend/src/modules/courses/courses.layout.test.ts`

The confirm-green transaction must compute the same derived fields as `updateHoleLayout` but write inside a `tx`. Extract the pure derivation so both share it.

- [ ] **Step 1: Write the failing test**

`backend/src/modules/courses/courses.layout.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLayoutWrite } from './courses.service.js';

const square = [
  { lat: 56, lng: 12 }, { lat: 56, lng: 12.0002 },
  { lat: 56.0001, lng: 12.0002 }, { lat: 56.0001, lng: 12 }
];

test('buildLayoutWrite: green only → status PARTIAL, no bearing/length', () => {
  const w = buildLayoutWrite({
    teePoint: null, greenPolygon: square, fairwayPolygons: [],
    bunkerPolygons: [], treesPolygons: [], obPolygons: []
  });
  assert.equal(w.greenPolygon, square);
  assert.equal(w.holeBearing, null);
  assert.equal(w.holeLengthMeters, null);
  assert.deepEqual(w.teeToGreenCenterline, []);
});

test('buildLayoutWrite: tee + green → derived length/bearing populated', () => {
  const w = buildLayoutWrite({
    teePoint: { lat: 55.997, lng: 12.0001 }, greenPolygon: square, fairwayPolygons: [],
    bunkerPolygons: [], treesPolygons: [], obPolygons: []
  });
  assert.ok(Number(w.holeLengthMeters) > 200 && Number(w.holeLengthMeters) < 400);
  assert.ok(w.teeToGreenCenterline.length === 2);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx tsx --test src/modules/courses/courses.layout.test.ts`
Expected: FAIL — `buildLayoutWrite` is not exported.

- [ ] **Step 3: Refactor `courses.service.ts`.** Extract the body of `updateHoleLayout`'s derivation into an exported pure function and call it from `updateHoleLayout`. Add near the other helpers (after `resolveGreenCenter`/`resolveBearing`):

```ts
export function buildLayoutWrite(geometry: HoleLayoutGeometry) {
  const greenCenter = resolveGreenCenter(geometry.greenPolygon);
  const bearing = geometry.teePoint && greenCenter ? resolveBearing(geometry.teePoint, greenCenter) : null;
  const length = geometry.teePoint && greenCenter ? haversineMeters(geometry.teePoint, greenCenter) : null;
  const centerline = geometry.teePoint && greenCenter ? [geometry.teePoint, greenCenter] : [];
  const fairwayPolygons = geometry.fairwayPolygons?.slice(0, 3)
    ?? (geometry.fairwayPolygon && geometry.fairwayPolygon.length > 0 ? [geometry.fairwayPolygon] : []);
  return {
    teePoint: geometry.teePoint,
    greenPolygon: geometry.greenPolygon,
    fairwayPolygon: fairwayPolygons,
    bunkerPolygons: geometry.bunkerPolygons,
    treesPolygons: geometry.treesPolygons,
    obPolygons: geometry.obPolygons,
    holeBearing: bearing,
    holeLengthMeters: length,
    teeToGreenCenterline: centerline,
    layoutStatus: fromGeometryStatus(geometry)
  };
}
```

Then replace the body of `updateHoleLayout` after the `hole` lookup with:
```ts
    return coursesRepository.updateHoleLayout(hole.id, buildLayoutWrite(geometry));
```

- [ ] **Step 4: Run to verify pass + no regression**

Run: `cd backend && npx tsx --test src/modules/courses/courses.layout.test.ts`
Expected: PASS (2 tests).
Run: `npm --prefix backend run test 2>&1 | tail -5`
Expected: whole backend suite still passes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/courses/courses.service.ts backend/src/modules/courses/courses.layout.test.ts
git commit -m "refactor(backend): extract buildLayoutWrite for reuse"
```

---

### Task 3: Green-candidate repository

**Files:**
- Create: `backend/src/modules/courses/greenCandidates.repository.ts`

- [ ] **Step 1: Implement.** No unit test (thin data layer, exercised via service tests + live verification):

```ts
import { GreenCandidateStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/client.js';
import { buildLayoutWrite } from './courses.service.js';

type GeoPoint = { lat: number; lng: number };
type Geometry = {
  teePoint: GeoPoint | null;
  greenPolygon: GeoPoint[];
  fairwayPolygons?: GeoPoint[][];
  fairwayPolygon?: GeoPoint[];
  bunkerPolygons: GeoPoint[][];
  treesPolygons: GeoPoint[][];
  obPolygons: GeoPoint[][];
};

export const greenCandidatesRepository = {
  listOpenForCourse(courseId: string) {
    return prisma.greenCandidate.findMany({
      where: { courseId, status: GreenCandidateStatus.OPEN },
      orderBy: { createdAt: 'asc' }
    });
  },

  createMany(courseId: string, items: Array<{ polygon: GeoPoint[]; forHoles: number[]; source: string }>) {
    return prisma.greenCandidate.createMany({
      data: items.map((i) => ({ courseId, polygon: i.polygon as unknown as Prisma.JsonArray, forHoles: i.forHoles, source: i.source }))
    });
  },

  // Atomic confirm: claim the candidate, guard the hole, write the green — all in one tx.
  // Preserves every other geometry field and only sets greenPolygon (merge-safe).
  // Returns { holeId } on success. Throws { code } on conflict (caught by the service).
  async confirmGreen(params: {
    courseId: string;
    holeNumber: number;
    candidateId: string;
    userId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const hole = await tx.hole.findFirst({
        where: { courseId: params.courseId, holeNumber: params.holeNumber },
        include: { holeLayout: true }
      });
      if (!hole) throw { code: 'hole-not-found' as const };

      const candidate = await tx.greenCandidate.findUnique({ where: { id: params.candidateId } });
      if (!candidate || candidate.courseId !== params.courseId) throw { code: 'candidate-not-found' as const };
      if (candidate.status !== GreenCandidateStatus.OPEN) throw { code: 'candidate-taken' as const };
      if (!candidate.forHoles.includes(params.holeNumber)) throw { code: 'not-a-candidate' as const };

      const existingGreen = (hole.holeLayout?.greenPolygon as GeoPoint[] | null) ?? [];
      if (existingGreen.length >= 3) throw { code: 'already-assigned' as const };

      // Atomic claim — if another confirm won the race, count is 0.
      const claim = await tx.greenCandidate.updateMany({
        where: { id: params.candidateId, status: GreenCandidateStatus.OPEN },
        data: { status: GreenCandidateStatus.ASSIGNED, assignedHoleNumber: params.holeNumber, confirmedByUserId: params.userId }
      });
      if (claim.count === 0) throw { code: 'candidate-taken' as const };

      const existing: Geometry = {
        teePoint: (hole.holeLayout?.teePoint as GeoPoint | null) ?? null,
        greenPolygon: [],
        fairwayPolygons: (hole.holeLayout?.fairwayPolygon as GeoPoint[][] | null) ?? [],
        bunkerPolygons: (hole.holeLayout?.bunkerPolygons as GeoPoint[][] | null) ?? [],
        treesPolygons: (hole.holeLayout?.treesPolygons as GeoPoint[][] | null) ?? [],
        obPolygons: (hole.holeLayout?.obPolygons as GeoPoint[][] | null) ?? []
      };
      const geometry = { ...existing, greenPolygon: candidate.polygon as unknown as GeoPoint[] };
      const write = buildLayoutWrite(geometry as never);
      await tx.holeLayout.upsert({
        where: { holeId: hole.id },
        create: { holeId: hole.id, ...write },
        update: write
      });
      return { holeId: hole.id };
    });
  }
};
```

- [ ] **Step 2: Typecheck**

Run: `npm --prefix backend run typecheck 2>&1 | tail -5` (or the package's lint if no typecheck script)
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/courses/greenCandidates.repository.ts
git commit -m "feat(backend): green-candidate repository with atomic confirm"
```

---

### Task 4: Green-candidate service (filter + typed conflicts)

**Files:**
- Create: `backend/src/modules/courses/greenCandidates.service.ts`
- Test: `backend/src/modules/courses/greenCandidates.service.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictError, NotFoundError } from '../../common/errors/AppError.js';
import { greenCandidatesRepository } from './greenCandidates.repository.js';
import { coursesRepository } from './courses.repository.js';
import { greenCandidatesService } from './greenCandidates.service.js';

const gcRepo = greenCandidatesRepository as any;
const cRepo = coursesRepository as any;

test('list filters out candidates whose every hole already has a green', async () => {
  const origList = gcRepo.listOpenForCourse;
  const origCourse = cRepo.getById;
  gcRepo.listOpenForCourse = async () => [
    { id: 'a', polygon: [1], forHoles: [3, 5] },
    { id: 'b', polygon: [1], forHoles: [8] }
  ];
  // hole 8 already resolved, holes 3 & 5 not
  cRepo.getById = async () => ({ holes: [
    { holeNumber: 3, holeLayout: { greenPolygon: [] } },
    { holeNumber: 5, holeLayout: null },
    { holeNumber: 8, holeLayout: { greenPolygon: [{},{},{}] } }
  ]});
  const out = await greenCandidatesService.listOpen('course-1');
  assert.deepEqual(out.map((c) => c.id), ['a']);
  assert.deepEqual(out[0], { id: 'a', polygon: [1], forHoles: [3, 5] });
  gcRepo.listOpenForCourse = origList;
  cRepo.getById = origCourse;
});

test('confirm maps repo conflict codes to typed errors', async () => {
  const orig = gcRepo.confirmGreen;
  const origCourse = cRepo.getById;
  cRepo.getById = async () => ({ id: 'course-1' });
  for (const [code, Err] of [
    ['already-assigned', ConflictError],
    ['candidate-taken', ConflictError],
    ['not-a-candidate', ConflictError],
    ['candidate-not-found', NotFoundError],
    ['hole-not-found', NotFoundError]
  ] as const) {
    gcRepo.confirmGreen = async () => { throw { code }; };
    await assert.rejects(
      () => greenCandidatesService.confirm('course-1', 3, 'cand-1', 'user-1'),
      Err,
      `code ${code}`
    );
  }
  gcRepo.confirmGreen = orig;
  cRepo.getById = origCourse;
});

test('confirm returns the mapped hole (with layout.geometry) on success', async () => {
  const orig = gcRepo.confirmGreen;
  const origHole = cRepo.getHoleWithLayout;
  const origCourse = cRepo.getById;
  cRepo.getById = async () => ({ id: 'course-1' });
  gcRepo.confirmGreen = async () => ({ holeId: 'hole-1' });
  cRepo.getHoleWithLayout = async () => ({
    id: 'hole-1', courseId: 'course-1', holeNumber: 3, par: 4, length: 320,
    hcpIndex: 5, createdAt: new Date(), updatedAt: new Date(),
    holeLayout: { id: 'l1', greenPolygon: [{ lat: 56, lng: 12 }, { lat: 56, lng: 12.001 }, { lat: 56.001, lng: 12 }],
      teePoint: null, fairwayPolygon: null, bunkerPolygons: [], treesPolygons: [], obPolygons: [], layoutStatus: 'PARTIAL' }
  });
  const out: any = await greenCandidatesService.confirm('course-1', 3, 'cand-1', 'user-1');
  assert.equal(out.holeNumber, 3);
  assert.equal(out.layout.geometry.greenPolygon.length, 3);
  gcRepo.confirmGreen = orig;
  cRepo.getHoleWithLayout = origHole;
  cRepo.getById = origCourse;
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx tsx --test src/modules/courses/greenCandidates.service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Two small prerequisites in the courses module** (verified present/absent 2026-07-10):
  - `ConflictError` (409) already exists in `backend/src/common/errors/AppError.ts` — just import it.
  - `mapHoleWithLayout` in `courses.service.ts:93` is module-local — change `const mapHoleWithLayout` to `export const mapHoleWithLayout` so the confirm service can return the same `{ ..., layout: { geometry } }` shape the webbapp consumes.
  - Add a repo method to `courses.repository.ts` (after `getHoleByNumber`) that includes the layout:
    ```ts
      getHoleWithLayout(courseId: string, holeNumber: number) {
        return prisma.hole.findFirst({ where: { courseId, holeNumber }, include: { holeLayout: true } });
      },
    ```

- [ ] **Step 4: Implement the service.**

```ts
import { ConflictError, NotFoundError } from '../../common/errors/AppError.js';
import { coursesRepository } from './courses.repository.js';
import { mapHoleWithLayout } from './courses.service.js';
import { greenCandidatesRepository } from './greenCandidates.repository.js';

type GeoPoint = { lat: number; lng: number };

export const greenCandidatesService = {
  async listOpen(courseId: string) {
    const course: any = await coursesRepository.getById(courseId);
    if (!course) throw new NotFoundError('Course not found');
    const greenByHole = new Map<number, boolean>();
    for (const h of course.holes ?? []) {
      const g = (h.holeLayout?.greenPolygon as GeoPoint[] | null) ?? [];
      greenByHole.set(h.holeNumber, g.length >= 3);
    }
    const open = await greenCandidatesRepository.listOpenForCourse(courseId);
    return open
      .filter((c: any) => (c.forHoles as number[]).some((n) => !greenByHole.get(n)))
      .map((c: any) => ({ id: c.id, polygon: c.polygon, forHoles: c.forHoles }));
  },

  async confirm(courseId: string, holeNumber: number, candidateId: string, userId: string) {
    const course: any = await coursesRepository.getById(courseId);
    if (!course) throw new NotFoundError('Course not found');
    try {
      await greenCandidatesRepository.confirmGreen({ courseId, holeNumber, candidateId, userId });
    } catch (e: any) {
      if (e?.code === 'candidate-not-found' || e?.code === 'hole-not-found') throw new NotFoundError('Not found');
      if (e?.code === 'already-assigned' || e?.code === 'candidate-taken' || e?.code === 'not-a-candidate') {
        throw new ConflictError(e.code);
      }
      throw e;
    }
    const hole = await coursesRepository.getHoleWithLayout(courseId, holeNumber);
    if (!hole) throw new NotFoundError('Hole not found');
    return mapHoleWithLayout(hole);
  }
};
```

- [ ] **Step 5: Run to verify pass**

Run: `cd backend && npx tsx --test src/modules/courses/greenCandidates.service.test.ts`
Expected: PASS (3 tests). Then `npm --prefix backend run test 2>&1 | tail -5` — whole suite green.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/courses/greenCandidates.service.ts backend/src/modules/courses/greenCandidates.service.test.ts backend/src/modules/courses/courses.service.ts backend/src/modules/courses/courses.repository.ts
git commit -m "feat(backend): green-candidate service with filtering and conflicts"
```

---

### Task 5: Schema, controller, routes

**Files:**
- Modify: `backend/src/modules/courses/courses.schema.ts`
- Modify: `backend/src/modules/courses/courses.controller.ts`
- Modify: `backend/src/modules/courses/courses.routes.ts`

- [ ] **Step 1: Add Zod schemas** to `courses.schema.ts`:

```ts
export const confirmGreenSchema = z.object({ candidateId: z.string().cuid() });
```
(reuse the existing `courseIdParamSchema` and `holeParamsSchema` for params.)

- [ ] **Step 2: Add controller methods** to `coursesController` in `courses.controller.ts` (import `greenCandidatesService` and `confirmGreenSchema`):

```ts
  async listGreenCandidates(request: FastifyRequest, reply: FastifyReply) {
    const { id } = courseIdParamSchema.parse(request.params);
    return reply.send(await greenCandidatesService.listOpen(id));
  },

  async confirmGreen(request: FastifyRequest, reply: FastifyReply) {
    const { id, holeNumber } = holeParamsSchema.parse(request.params);
    const { candidateId } = confirmGreenSchema.parse(request.body);
    const hole = await greenCandidatesService.confirm(id, holeNumber, candidateId, request.auth!.userId);
    return reply.send(hole);
  },
```

- [ ] **Step 3: Wire routes** in `courses.routes.ts`. The two player routes use the global `requireAuth` only (NO `requireAdmin`); the bulk-create route (used by the importer) is admin-only:

```ts
  app.get('/:id/green-candidates', coursesController.listGreenCandidates);
  app.post('/:id/holes/:holeNumber/confirm-green', coursesController.confirmGreen);
  app.post('/:id/green-candidates', { preHandler: [requireAdmin] }, coursesController.createGreenCandidates);
```

Also add the admin bulk-create controller method (imports `greenCandidatesRepository` and `createGreenCandidatesSchema`):
```ts
  async createGreenCandidates(request: FastifyRequest, reply: FastifyReply) {
    const { id } = courseIdParamSchema.parse(request.params);
    const { items } = createGreenCandidatesSchema.parse(request.body);
    await greenCandidatesRepository.createMany(id, items);
    return reply.code(201).send({ created: items.length });
  },
```
and its schema in `courses.schema.ts`:
```ts
export const createGreenCandidatesSchema = z.object({
  items: z.array(z.object({
    polygon: z.array(z.object({ lat: z.number(), lng: z.number() })).min(3),
    forHoles: z.array(z.number().int().min(1).max(18)).min(1),
    source: z.string().min(1)
  })).min(1)
});
```

- [ ] **Step 4: Verify the app boots + routes exist**

Run: `npm --prefix backend run typecheck 2>&1 | tail -5` → clean.
Run: start the backend (`npm --prefix backend run dev:local` in the background), then
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"anna@golf.test","password":"Anna123!"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/v1/courses/cmres00c20003bh8j5cbxx36h/green-candidates" -H "Authorization: Bearer $TOKEN"
```
Expected: `200` — a seeded PLAYER account (not admin) reaches the route, confirming it is player-accessible. (Body is `[]` if no candidates published yet.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/courses/courses.schema.ts backend/src/modules/courses/courses.controller.ts backend/src/modules/courses/courses.routes.ts
git commit -m "feat(backend): green-candidate routes (player-facing)"
```

---

### Task 6: Publish candidates from the importer

**Files:**
- Modify: `tools/course-geometry/lib/api.mjs`
- Create: `tools/course-geometry/publish-candidates.mjs`

- [ ] **Step 1: Add API methods** to `createApi` in `lib/api.mjs` (alongside `patchHoleLayout`). The bulk-create route was added in Task 5, Step 3:

```ts
    listGreenCandidates: (courseId) => call('GET', `/api/v1/courses/${courseId}/green-candidates`),
    createGreenCandidates: (courseId, items) =>
      call('POST', `/api/v1/courses/${courseId}/green-candidates`, { items })
```

- [ ] **Step 2: Implement `publish-candidates.mjs`**

```js
#!/usr/bin/env node
// Publish tied/unassigned greens as OPEN player-tap candidates.
//
// Usage: node publish-candidates.mjs candidates.<courseId>.json [--api-base ...] [--email ...] [--password ...]
//
// Input JSON: { courseId, candidates: [ { polygon: [{lat,lng}...], forHoles: [Int], source } ] }
import { readFileSync } from 'node:fs';
import { createApi } from './lib/api.mjs';
import { validateGreen } from './lib/match.mjs';

function parseArgs(argv) {
  const args = {
    file: argv[2],
    apiBase: process.env.GT_API_BASE ?? 'http://localhost:3000',
    email: process.env.GT_ADMIN_EMAIL ?? 'admin@golf.test',
    password: process.env.GT_ADMIN_PASSWORD ?? 'Admin123!'
  };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--api-base') args.apiBase = argv[++i];
    else if (a === '--email') args.email = argv[++i];
    else if (a === '--password') args.password = argv[++i];
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.file || args.file.startsWith('--')) throw new Error('Usage: node publish-candidates.mjs candidates.<courseId>.json');
  return args;
}

const args = parseArgs(process.argv);
const data = JSON.parse(readFileSync(args.file, 'utf8'));
if (!Array.isArray(data.candidates) || data.candidates.length === 0) throw new Error('No candidates in file');

const items = data.candidates.map((c, i) => {
  const v = validateGreen(c.polygon);
  if (!v.ok) throw new Error(`candidate ${i}: ${v.reasons.join('; ')}`);
  if (!Array.isArray(c.forHoles) || c.forHoles.length === 0) throw new Error(`candidate ${i}: forHoles required`);
  return { polygon: v.ring, forHoles: c.forHoles, source: c.source ?? 'manual' };
});

const api = createApi(args.apiBase);
await api.login(args.email, args.password);
const res = await api.createGreenCandidates(data.courseId, items);
console.log(`Published ${res.created ?? items.length} candidate(s) to course ${data.courseId}`);
```

- [ ] **Step 3: Smoke (arg validation only, no network)**

Run: `cd tools/course-geometry && node publish-candidates.mjs` → `Usage: ...`, exit 1.
Run: `node --check publish-candidates.mjs` → OK.
Run: `npm test` → still 38/38.

- [ ] **Step 4: Commit**

```bash
git add tools/course-geometry/lib/api.mjs tools/course-geometry/publish-candidates.mjs
git commit -m "feat(tools): publish green candidates for player tap-to-assign"
```
(The backend bulk route/controller/schema were committed in Task 5.)

---

### Task 7: Webbapp API + types

**Files:**
- Modify: `webbapp/src/lib/api.ts`
- Modify: `webbapp/src/lib/types.ts`

- [ ] **Step 1: Add the DTO type** to `types.ts`:

```ts
export type GreenCandidate = { id: string; polygon: GeoPoint[]; forHoles: number[] };
```

- [ ] **Step 2: Add two methods** to `useCoursesApi()` in `api.ts` (inside the returned object, following the `client.request<T>` pattern):

```ts
      getGreenCandidates: async (courseId: string): Promise<GreenCandidate[]> =>
        client.request<GreenCandidate[]>(`/courses/${courseId}/green-candidates`),
      confirmGreen: async (courseId: string, holeNumber: number, candidateId: string) =>
        client.request(`/courses/${courseId}/holes/${holeNumber}/confirm-green`, {
          method: 'POST',
          body: JSON.stringify({ candidateId })
        })
```
(import `GreenCandidate` from `./types` at the top if not already covered by a wildcard.)

- [ ] **Step 3: Typecheck**

Run: `npm --prefix webbapp run typecheck 2>&1 | tail -5` → clean.

- [ ] **Step 4: Commit**

```bash
git add webbapp/src/lib/api.ts webbapp/src/lib/types.ts
git commit -m "feat(webbapp): green-candidate API client + type"
```

---

### Task 8: Candidate rendering in HolePlayMap (clearly-marked greens)

**Files:**
- Modify: `webbapp/src/components/HolePlayMap.tsx`

Read the file first — follow the existing `toPolygon`/`buildLayoutFC` pattern and how sources/layers are added in the map-init `useEffect`. Candidates are passed as a new prop and rendered as high-contrast, **non-green** markers so they never blend into the satellite grass.

- [ ] **Step 1: Add the prop** to `Props`:

```ts
  /** Öppna kandidatgreener för aktuellt hål (endast när hålet saknar green). */
  greenCandidates?: Array<{ id: string; polygon: GeoPoint[] }>;
  /** Anropas när spelaren trycker på en kandidat. */
  onCandidateTap?: (id: string) => void;
  /** Markerad kandidat (highlightas; övriga dimmas). */
  selectedCandidateId?: string | null;
```

- [ ] **Step 2: Build a candidate FeatureCollection** (add near `buildLayoutFC`). Two features per candidate: the ring (for the outline+fill) and a center point (the pin / tap target):

```ts
const buildCandidateFC = (
  candidates: Array<{ id: string; polygon: GeoPoint[] }>,
  selectedId: string | null | undefined
) => {
  const features: GeoJSON.Feature[] = [];
  for (const c of candidates) {
    if (c.polygon.length < 3) continue;
    const selected = c.id === selectedId;
    features.push({
      type: 'Feature', id: `${c.id}-ring`,
      properties: { candidateId: c.id, selected },
      geometry: { type: 'Polygon', coordinates: [c.polygon.map((p) => [p.lng, p.lat])] }
    });
    const cx = c.polygon.reduce((s, p) => s + p.lng, 0) / c.polygon.length;
    const cy = c.polygon.reduce((s, p) => s + p.lat, 0) / c.polygon.length;
    features.push({
      type: 'Feature', id: `${c.id}-pin`,
      properties: { candidateId: c.id, selected },
      geometry: { type: 'Point', coordinates: [cx, cy] }
    });
  }
  return { type: 'FeatureCollection' as const, features };
};
```

- [ ] **Step 3: Register source + layers** in the map-init `useEffect` (where the layout source/layers are added). Colors: bright amber outline + white pin, teal when selected, dimmed when another is selected — never green:

```ts
map.addSource('candidates', { type: 'geojson', data: EMPTY_FC });
map.addLayer({
  id: 'candidate-fill', type: 'fill', source: 'candidates',
  filter: ['==', ['geometry-type'], 'Polygon'],
  paint: { 'fill-color': ['case', ['get', 'selected'], '#1D9E75', '#EF9F27'],
           'fill-opacity': ['case', ['get', 'selected'], 0.35, 0.18] }
});
map.addLayer({
  id: 'candidate-outline', type: 'line', source: 'candidates',
  filter: ['==', ['geometry-type'], 'Polygon'],
  paint: { 'line-color': ['case', ['get', 'selected'], '#0F6E56', '#FFFFFF'],
           'line-width': 3 }
});
map.addLayer({
  id: 'candidate-pin', type: 'circle', source: 'candidates',
  filter: ['==', ['geometry-type'], 'Point'],
  paint: { 'circle-radius': 11, 'circle-color': ['case', ['get', 'selected'], '#1D9E75', '#FFFFFF'],
           'circle-stroke-color': '#0F6E56', 'circle-stroke-width': 3 }
});
```

- [ ] **Step 4: Feed the source + wire taps.** In the effect that updates sources when props change, add:
```ts
(map.getSource('candidates') as maplibregl.GeoJSONSource | undefined)
  ?.setData(buildCandidateFC(greenCandidates ?? [], selectedCandidateId));
```
And once, after layers exist, register click + cursor handlers on the pin+fill layers:
```ts
for (const layerId of ['candidate-pin', 'candidate-fill']) {
  map.on('click', layerId, (e) => {
    const id = e.features?.[0]?.properties?.candidateId;
    if (id && onCandidateTapRef.current) onCandidateTapRef.current(String(id));
  });
  map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
}
```
Use a ref (`onCandidateTapRef`) for the callback to avoid re-registering on every render (match how the file handles other callbacks; if it doesn't use refs, guard registration so it runs once).

- [ ] **Step 5: Verify build + no regression**

Run: `npm --prefix webbapp run typecheck 2>&1 | tail -5` → clean.
Run: `npm --prefix webbapp run lint 2>&1 | tail -5` → clean (or no new errors).

- [ ] **Step 6: Commit**

```bash
git add webbapp/src/components/HolePlayMap.tsx
git commit -m "feat(webbapp): render tappable candidate greens on the play map"
```

---

### Task 9: Play-view banner, confirm sheet, GPS soft-check

**Files:**
- Create: `webbapp/src/components/round-hole/CandidateConfirmSheet.tsx`
- Modify: `webbapp/src/app/play/round/[roundId]/[holeNumber]/page.tsx`

- [ ] **Step 1: Build the bottom sheet.** Follow the existing sheet components in `webbapp/src/components/round-hole/` (e.g. `HoleSettingsSheet.tsx`) for styling/animation conventions — read one first.

```tsx
'use client';
import type { GeoPoint } from '@/lib/types';
import { getGeoDistanceMeters } from '@/lib/holeGeometry';

type Props = {
  holeNumber: number;
  candidateCenter: GeoPoint;
  playerPosition: GeoPoint | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function CandidateConfirmSheet({ holeNumber, candidateCenter, playerPosition, onConfirm, onCancel }: Props) {
  const distance = playerPosition ? Math.round(getGeoDistanceMeters(playerPosition, candidateCenter)) : null;
  const farAway = distance != null && distance > 600;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl bg-surface p-4 shadow-xl">
      <p className="text-base font-medium">Är detta green för hål {holeNumber}?</p>
      <p className="mt-1 text-sm text-muted">
        {distance != null ? `Ca ${distance} m från dig · ` : ''}valet låses för banan
      </p>
      {farAway && (
        <p className="mt-2 text-sm text-warning">Du verkar inte vara vid banan</p>
      )}
      <div className="mt-3 flex gap-2">
        <button onClick={onCancel} className="flex-1 btn-secondary py-3">Avbryt</button>
        <button onClick={onConfirm} className="flex-[1.4] btn-primary py-3">Ja, detta är green {holeNumber}</button>
      </div>
    </div>
  );
}
```
(Match the actual utility class names in the repo — read an existing sheet/button to confirm `btn-primary`/`btn-secondary`/`bg-surface`/`text-muted`/`text-warning` exist; adjust to the real ones.)

- [ ] **Step 2: Wire into the play page.** In `page.tsx`, after `courseId`/`layout`/`playerPosition` are available:

```tsx
const [candidates, setCandidates] = useState<GreenCandidate[]>([]);
const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

useEffect(() => {
  if (!courseId) return;
  let alive = true;
  coursesApi.getGreenCandidates(courseId)
    .then((cs) => { if (alive) setCandidates(cs); })
    .catch(() => {});
  return () => { alive = false; };
}, [courseId, coursesApi]);

const holeHasGreen = (layout?.greenPolygon.length ?? 0) >= 3;
const holeCandidates = holeHasGreen
  ? []
  : candidates.filter((c) => c.forHoles.includes(holeNumber));

const selectedCandidate = holeCandidates.find((c) => c.id === selectedCandidateId) ?? null;
const candidateCenter = selectedCandidate
  ? { lat: selectedCandidate.polygon.reduce((s, p) => s + p.lat, 0) / selectedCandidate.polygon.length,
      lng: selectedCandidate.polygon.reduce((s, p) => s + p.lng, 0) / selectedCandidate.polygon.length }
  : null;

const confirmGreen = useCallback(async () => {
  if (!courseId || !selectedCandidateId) return;
  try {
    const hole: any = await coursesApi.confirmGreen(courseId, holeNumber, selectedCandidateId);
    setLayout(hole.layout.geometry);           // light the distance line immediately
    setCandidates((cs) => cs.filter((c) => c.id !== selectedCandidateId));
    setSelectedCandidateId(null);
    toast.show('Hål ' + holeNumber + ' uppdaterat');
  } catch {
    // race (409) or error: refetch; the winning green will render, banner drops
    coursesApi.getGreenCandidates(courseId).then(setCandidates).catch(() => {});
    setSelectedCandidateId(null);
  }
}, [courseId, holeNumber, selectedCandidateId, coursesApi, toast]);
```

- [ ] **Step 3: Render the map props, banner, and sheet.** Pass to `<HolePlayMap>`: `greenCandidates={holeCandidates} selectedCandidateId={selectedCandidateId} onCandidateTap={setSelectedCandidateId}`. Add the discreet banner (only when `holeCandidates.length > 0 && !selectedCandidateId`) and the sheet (when `selectedCandidate`):

```tsx
{holeCandidates.length > 0 && !selectedCandidateId && (
  <div className="absolute inset-x-3 bottom-24 z-30 rounded-lg bg-warning-softer px-3 py-2 text-sm text-warning">
    Vilken green spelar du mot? Tryck på den så får du avstånd
  </div>
)}
{selectedCandidate && candidateCenter && (
  <CandidateConfirmSheet
    holeNumber={holeNumber}
    candidateCenter={candidateCenter}
    playerPosition={playerPosition}
    onConfirm={() => void confirmGreen()}
    onCancel={() => setSelectedCandidateId(null)}
  />
)}
```
(Positioning classes must match the play view's existing overlay layout — read the surrounding JSX and place the banner/sheet consistently with the other overlays.)

- [ ] **Step 4: Verify build**

Run: `npm --prefix webbapp run typecheck 2>&1 | tail -5` → clean.
Run: `npm --prefix webbapp run lint 2>&1 | tail -5` → clean/no new errors.

- [ ] **Step 5: Commit**

```bash
git add webbapp/src/components/round-hole/CandidateConfirmSheet.tsx "webbapp/src/app/play/round/[roundId]/[holeNumber]/page.tsx"
git commit -m "feat(webbapp): tap-to-assign banner + confirm sheet in play view"
```

---

### Task 10: Live verification + PR screenshots (Albatross)

**Files:** none (verification; fix-ups as `fix(...)` commits if needed).

Local stack running (docker `golftrainer-db`, backend :3000, webbapp :3002). Albatross Albatrossen `cmrfcwx60006zbh8jabmilh0g` (holes 3, 5, 8 unresolved), Birdiebanan `cmres00c20003bh8j5cbxx36h` (holes 5, 8 unresolved). Seeded player `anna@golf.test` / `Anna123!`.

- [ ] **Step 1: Publish the tied candidates.** For Albatrossen holes 3/5/8, build `candidates.<courseId>.json` from the tied greens recorded during the tee-assignment live run (regenerate the dump with `node import-greens.mjs --course-id <id> --club "Albatross" --dry-run --refetch` and pull the specific tied greens from `unassigned.greens`; set `forHoles` to the tied hole numbers per green). Run `node publish-candidates.mjs candidates.<courseId>.json`. Verify: `GET .../green-candidates` as the player returns the open candidates for the unresolved holes only.

- [ ] **Step 2: API confirm path.** As the player token, `POST .../holes/3/confirm-green {candidateId}` → 200, returns the hole with a ≥3-pt greenPolygon. Re-POST the same → 409. Confirm a candidate for a hole NOT in its `forHoles` → 409. GET again → the assigned candidate is gone and hole 3 no longer appears.

- [ ] **Step 3: Webbapp E2E.** Log in as the player, open a round on Albatrossen, navigate to hole 5. Confirm: the banner shows, the candidate greens render as bright amber outlines with white pins (NOT green, clearly visible on the satellite tiles), tapping one opens the sheet with a distance, confirming updates the map with the real green and drops the banner. Drive this yourself with the browser tools; screenshot each state.

- [ ] **Step 4: Self-healing check.** After assigning a shared green via one hole, GET candidates → confirm it disappeared from the other hole's list (and if only one remained there, that hole now has a single candidate → sheet reads as yes/no).

- [ ] **Step 5: PR screenshots.** Per CLAUDE.md (visual change in webbapp), capture the play view states (banner + marked candidates, confirm sheet, resolved hole with distance) via `tools/pr-screenshots/` and attach to the PR.

- [ ] **Step 6: Wrap-up.** `npm --prefix backend run test` green; `cd tools/course-geometry && npm test` → 38/38; webbapp typecheck/lint clean. `git status` clean apart from ignored artifacts + AGENTS.md. Report the per-hole outcome, the screenshots, and any hole still unresolved.
