#!/usr/bin/env node
// Ranked hole↔green assignment candidates from an unassigned dump + the
// course scorecard. Prints arithmetic; writes nothing — the agent copies
// conclusions into the greens JSON (status "matched", source "assign:..."
// or "banguide:<url>") and imports with --from-json.
//
// Usage: node assign.mjs greens.<courseId>.json [--course-id <id>] [--api-base ...] [--json]
import { readFileSync } from 'node:fs';
import { haversineMeters, centroid } from './lib/geo.mjs';
import { pickTee, TEE_BAND_MIN, TEE_BAND_MAX } from './lib/match.mjs';
import { createApi } from './lib/api.mjs';

function parseArgs(argv) {
  const args = {
    dump: argv[2],
    apiBase: process.env.GT_API_BASE ?? 'http://localhost:3000',
    email: process.env.GT_ADMIN_EMAIL ?? 'admin@golf.test',
    password: process.env.GT_ADMIN_PASSWORD ?? 'Admin123!',
    json: false
  };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--course-id') args.courseId = argv[++i];
    else if (a === '--api-base') args.apiBase = argv[++i];
    else if (a === '--email') args.email = argv[++i];
    else if (a === '--password') args.password = argv[++i];
    else if (a === '--json') args.json = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.dump || args.dump.startsWith('--')) {
    throw new Error('Usage: node assign.mjs greens.<courseId>.json [--course-id <id>] [--json]');
  }
  return args;
}

function readJson(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`${path} not found`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${path} is not valid JSON`);
  }
}

const args = parseArgs(process.argv);
const data = readJson(args.dump);
if (!data.unassigned) {
  throw new Error(
    `${args.dump} has no "unassigned" block — this file is already matched; use preview.mjs + import-greens.mjs --from-json.`
  );
}
const { holeWays = [], greens = [], tees = [] } = data.unassigned;

const api = createApi(args.apiBase);
await api.login(args.email, args.password);
const course = await api.getCourse(args.courseId ?? data.courseId);
console.log(`Course: ${course.clubName} / ${course.courseName} (${course.holeCount} holes)`);
console.log(`Unassigned: ${holeWays.length} hole way(s), ${greens.length} green(s), ${tees.length} tee(s)`);

const rows = course.holes.map((hole) => {
  const L = hole.length;
  if (!Number.isFinite(L) || L <= 0) {
    return { hole: hole.holeNumber, par: hole.par, note: 'no length — cannot rank' };
  }
  const candidates = greens
    .map((g) => {
      const gc = centroid(g.points);
      // Rank on the raw best-in-band tee fit — pickTee's ambiguity refusal
      // must not hide a green from the ranking; surface it as a flag instead.
      const inBand = tees
        .map((t) => ({ t, d: haversineMeters(t.point, gc) }))
        .filter(({ d }) => d >= TEE_BAND_MIN * L && d <= TEE_BAND_MAX * L)
        .sort((a, b) => Math.abs(a.d - L) - Math.abs(b.d - L))[0];
      if (!inBand) return null;
      const verdict = pickTee({ tees, greenCenter: gc, holeLengthM: L });
      return {
        greenId: g.id,
        greenCenter: gc,
        teeId: inBand.t.id,
        teePoint: inBand.t.point,
        distanceM: Math.round(inBand.d),
        errorM: Math.round(Math.abs(inBand.d - L)),
        teeVerdict: verdict?.point ? 'ok' : (verdict?.reason ?? 'none')
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.errorM - b.errorM)
    .slice(0, 5);
  const wayEnds = holeWays
    .filter((w) => Number(w.ref) === hole.holeNumber && w.points.length >= 2)
    .map((w) => w.points[w.points.length - 1]);
  return { hole: hole.holeNumber, par: hole.par, lengthM: L, candidates, wayEnds };
});

// course.holes is holeNumber-ordered (guaranteed by the API's orderBy).
// Chain hint: best candidate's green → next hole's best candidate tee.
for (let i = 0; i < rows.length; i++) {
  const cur = rows[i].candidates?.[0];
  const next = rows[i + 1]?.candidates?.[0];
  if (cur && next) rows[i].chainToNextM = Math.round(haversineMeters(cur.greenCenter, next.teePoint));
}

if (args.json) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const bestCounts = new Map();
  for (const r of rows) {
    const b = r.candidates?.[0]?.greenId;
    if (b) bestCounts.set(b, (bestCounts.get(b) ?? 0) + 1);
  }
  console.table(
    rows.map((r) => ({
      hole: r.hole,
      par: r.par,
      lengthM: r.lengthM ?? r.note,
      best: r.candidates?.[0] ? r.candidates[0].greenId + (bestCounts.get(r.candidates[0].greenId) > 1 ? '*' : '') : '-',
      errM: r.candidates?.[0]?.errorM ?? '-',
      tee: r.candidates?.[0]?.teeVerdict ?? '-',
      '2nd': r.candidates?.[1]?.greenId ?? '-',
      '2nd errM': r.candidates?.[1]?.errorM ?? '-',
      ways: r.wayEnds?.length ?? 0,
      chainM: r.chainToNextM ?? '-'
    }))
  );
  console.log('Assign a hole when best errM < 10 and the runner-up is > 25 worse; otherwise check the banguide/overview snap.');
  console.log('* = green is the best candidate for more than one hole — resolve those together.');
}
