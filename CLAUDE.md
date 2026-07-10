# GolfTrainer — agent guide

Monorepo with four parts:

| Dir | What | Dev command | Port |
|-----|------|-------------|------|
| `backend` | Fastify + Prisma API | `npm --prefix backend run dev:local` | 3000 |
| `webbapp` | Next.js player web app | `npm --prefix webbapp run dev` | 3002 |
| `admin-web` | Next.js admin app | `npm --prefix admin-web run dev` | 3005 |
| `mobile` | Expo / React Native | — | — |

## Pull requests with frontend changes — ALWAYS attach screenshots

When a PR changes anything visual in `webbapp` or `admin-web`, attach
screenshots of the affected views so the change can be reviewed before merge.
Tooling lives in `tools/pr-screenshots/` (see its README).

Workflow:

1. Make the change on a feature branch.
2. Ensure backend + the relevant frontend are running, and the DB is seeded:
   ```bash
   npm --prefix backend run prisma:seed:local   # if not already seeded
   npm --prefix backend run dev:local           # :3000
   npm --prefix webbapp run dev                 # :3002  (or admin-web :3005)
   ```
3. Write a manifest listing **only the routes your PR touched** (copy
   `tools/pr-screenshots/shots.webbapp.example.json` → `shots.json`).
4. Capture + post:
   ```bash
   cd tools/pr-screenshots
   node capture.mjs --manifest shots.json
   gh pr create ...        # if the PR doesn't exist yet
   node post.mjs           # pushes images to pr-assets, comments on the PR
   ```

Notes:
- Screenshots go to an orphan `pr-assets` branch and are inlined in a PR
  comment — they never land in main or the PR diff.
- Login uses seeded accounts: `anna@golf.test` / `Anna123!` (player),
  `admin@golf.test` / `Admin123!` (admin). Tokens are injected into
  `localStorage` (`golftrainer.auth.tokens` for webbapp,
  `gt_admin_auth_tokens` for admin-web).
- Re-running `post.mjs` updates the existing comment instead of stacking new ones.

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

If the course does not exist yet, create it first (admin-only REST, seeded
`admin@golf.test` / `Admin123!`):

1. `POST /api/v1/courses` — `{ clubName, courseName, teeName, holeCount }`
   (`holeCount` must be literally 9 or 18)
2. `POST /api/v1/courses/:id/holes` — `{ holeCount }` (idempotent)
3. `PATCH /api/v1/courses/:id/holes/:n` — `{ par, length, hcpIndex }` per hole

Only fall back to hand-drawing in admin-web's HoleManager when OSM has no
data and satellite tracing fails.

## Conventions

- Commit messages follow the existing style, e.g. `ui(webbapp): …`,
  `feat(notifications): …`, `fix(backend): …`.
- CI (`.github/workflows/pr-checks.yml`) runs lint + typecheck for backend and
  mobile. Run `npm run lint` / `npm run typecheck` in the package you touched
  before opening a PR.
