#!/usr/bin/env node
// Turn the PR's changed files into a screenshot manifest, so CI shoots the
// views you actually touched instead of a fixed list.
//
// Usage:
//   node resolve-routes.mjs --app webbapp --appdir webbapp \
//     --default shots.webbapp.ci.json --base origin/main --out shots.generated.json
//
// Logic:
//   - Look at changed files under `${appdir}/src/app/**/page.tsx`.
//   - Map each to its App Router route ( /play, /, ... ). Route groups `(x)`
//     are stripped; dynamic segments `[x]` are skipped (no real id to visit).
//   - If nothing maps to a concrete static route (e.g. only shared
//     components/lib changed, or only dynamic routes), fall back to the
//     committed default manifest unchanged.
//   - Otherwise emit the default manifest's config with `shots` replaced by the
//     resolved routes, one shot per route at the app's primary viewport.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--app') a.app = argv[++i];
    else if (k === '--appdir') a.appdir = argv[++i];
    else if (k === '--default') a.default = argv[++i];
    else if (k === '--base') a.base = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else throw new Error(`Unknown arg: ${k}`);
  }
  for (const req of ['app', 'appdir', 'default', 'out'])
    if (!a[req]) throw new Error(`Missing --${req}`);
  return a;
}

function changedFiles(base) {
  const refs = base ? [`${base}...HEAD`] : ['HEAD~1...HEAD'];
  try {
    const out = execFileSync('git', ['diff', '--name-only', ...refs], { encoding: 'utf8' });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// "webbapp/src/app/(auth)/play/page.tsx" -> "/play" ; dynamic -> null
function fileToRoute(file, appdir) {
  const prefix = `${appdir}/src/app`;
  if (!file.startsWith(prefix + '/') || !file.endsWith('/page.tsx')) return undefined;
  let rel = file.slice(prefix.length, -'/page.tsx'.length); // "" or "/(auth)/play"
  const segments = rel.split('/').filter(Boolean);
  const kept = [];
  for (const seg of segments) {
    if (/^\(.*\)$/.test(seg)) continue; // route group — not in URL
    if (/^@/.test(seg)) return null; // parallel slot
    if (/\[.*\]/.test(seg)) return null; // dynamic — no concrete id to visit
    kept.push(seg);
  }
  return '/' + kept.join('/');
}

function main() {
  const args = parseArgs(process.argv);
  const def = JSON.parse(readFileSync(resolve(args.default), 'utf8'));
  const primaryViewport = Object.keys(def.viewports ?? { desktop: {} })[0] ?? 'desktop';

  const files = changedFiles(args.base);
  const routes = new Set();
  let skippedDynamic = 0;
  for (const f of files) {
    const r = fileToRoute(f, args.appdir);
    if (r === null) skippedDynamic++;
    else if (typeof r === 'string') routes.add(r);
  }

  if (routes.size === 0) {
    const why = skippedDynamic
      ? `only dynamic/parallel routes changed (${skippedDynamic}) — can't pick an id`
      : 'no page.tsx routes changed (shared components/lib?)';
    console.error(`→ ${args.app}: ${why}; using default manifest.`);
    writeFileSync(resolve(args.out), JSON.stringify(def, null, 2));
    return;
  }

  const shots = [...routes].sort().map((path) => ({
    name: path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-'),
    path,
    viewport: primaryViewport,
    waitFor: 1500,
  }));

  const manifest = { ...def, shots };
  writeFileSync(resolve(args.out), JSON.stringify(manifest, null, 2));
  console.error(`→ ${args.app}: targeting ${shots.length} changed route(s): ${[...routes].sort().join(', ')}`);
}

try {
  main();
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
