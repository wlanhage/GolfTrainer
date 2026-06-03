# PR screenshots

Capture frontend screenshots and attach them to a pull request as an inline
comment, so changes can be reviewed visually before merging.

## One-time setup

```bash
cd tools/pr-screenshots
npm install
npx playwright install chromium   # downloads the headless browser
gh auth login                     # needed once, to post PR comments
```

## How it works

1. **`capture.mjs`** logs in via the backend API with a seeded test account,
   injects the auth tokens into `localStorage` (the same way the apps do), then
   screenshots each route/viewport listed in a manifest file. It also records
   per-page health (HTTP status, uncaught JS errors, console errors) so a
   crashed page gets flagged instead of silently shot. (Note: Next dev serves
   not-found pages as HTTP 200, so a missing route shows as a blank page rather
   than a 4xx — uncaught JS errors are the reliable "broken" signal.)
   Shots are stabilized (reduced motion, webfonts loaded, animations frozen)
   so they aren't captured mid-render.
2. **`post.mjs`** pushes the PNGs to an orphan **`pr-assets`** branch (so main
   and the PR diff stay clean) and posts — or updates — a PR comment that
   inlines the images via immutable raw GitHub URLs. The comment ends with a
   provenance footer: source branch @ head commit, a link to the Actions run
   (in CI), and a capture timestamp.

## Usage

Prerequisites: backend running + DB seeded (`npm --prefix backend run prisma:seed:local`),
and the relevant dev server running (`npm --prefix webbapp run dev` → :3002,
`npm --prefix admin-web run dev` → :3005).

```bash
cd tools/pr-screenshots

# 1. Write/adjust a manifest for what changed (copy an example):
cp shots.webbapp.example.json shots.json
# edit shots.json -> list only the routes your PR touched

# 2. Capture
node capture.mjs --manifest shots.json

# 3. Post to the PR (auto-detects the PR for the current branch)
node post.mjs

# Preview the comment without pushing/posting:
node post.mjs --dry-run
```

Useful flags:

| flag | script | meaning |
|------|--------|---------|
| `--manifest <f>` | capture | manifest file (required) |
| `--headed` | capture | watch the browser run |
| `--no-auth` | capture | skip login (public pages only) |
| `--out <dir>` | both | screenshot output dir (default `./out`) |
| `--pr <n>` | post | target PR (default: PR of current branch) |
| `--dry-run` | post | print the comment, don't push or post |

## Manifest format

```jsonc
{
  "app": "webbapp",                              // label + filename prefix
  "title": "Webbapp",                            // shown in the comment heading
  "baseUrl": "http://localhost:3002",
  "apiBaseUrl": "http://localhost:3000/api/v1",
  "tokenKey": "golftrainer.auth.tokens",         // webbapp; admin-web uses gt_admin_auth_tokens
  "account": { "email": "anna@golf.test", "password": "Anna123!" },
  "viewports": { "mobile": { "width": 390, "height": 844 } },
  "shots": [
    {
      "name": "play-mode",       // short slug
      "path": "/play",           // route to visit
      "viewport": "mobile",      // key from viewports (mobile | desktop)
      "waitFor": 1500,           // ms to wait, OR a CSS selector to wait for
      "fullPage": true,          // default true
      "localStorage": {}         // optional extra localStorage seeds
    }
  ]
}
```

Seeded test accounts (from `backend/scripts/seed.ts`):
`anna@golf.test` / `Anna123!` (player), `admin@golf.test` / `Admin123!` (admin).

`shots.json` is gitignored — keep it as a scratch file per PR.

## Cloud mode (GitHub Actions — no local environment)

`.github/workflows/pr-screenshots.yml` runs the whole thing in the cloud, so
you can open a PR from anywhere (including a phone) and screenshots appear
automatically:

1. Trigger: any PR that touches `webbapp/**`, `admin-web/**`, or this tooling.
2. The runner boots a Postgres service, runs migrations + `seed`, starts the
   backend, then builds & starts the changed app(s).
3. `resolve-routes.mjs` reads the PR diff and shoots **only the changed
   routes** (`src/app/**/page.tsx` → `/route`). Route groups `(x)` are
   stripped; dynamic routes `[id]` are skipped. If only shared
   components/lib changed, it falls back to the committed default manifest
   (`shots.webbapp.ci.json` / `shots.admin.ci.json`).
4. `post.mjs` comments on the PR using the built-in `GITHUB_TOKEN` — no
   `gh auth login`, no secrets. JWT secrets are dummy values in the workflow;
   the test accounts come from the seed script.

When a PR is **merged or closed**, `pr-screenshots-cleanup.yml` deletes that
branch's images from `pr-assets` (the comment stays, its images become broken
links). Everything is self-contained — no repository secrets are required.

To change the fallback routes, edit the `*.ci.json` manifests.
