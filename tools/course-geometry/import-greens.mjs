#!/usr/bin/env node
// Import green polygons for an existing course from OpenStreetMap.
//
// Usage:
//   node import-greens.mjs --course-id <cuid> --club "Vasatorp" [--course "TC"]
//     [--api-base http://localhost:3000] [--email ...] [--password ...]
//     [--dry-run] [--force] [--from-json greens.<id>.json]
//
// Writes greens.<courseId>.json (match results) so unresolved holes can be
// hand-edited and re-imported with --from-json. Exit codes: 0 all holes
// resolved, 1 fatal error, 2 completed with unresolved holes.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildOverpassQuery, parseOverpass, fetchOverpass } from './lib/osm.mjs';
import { matchGreens, validateGreen } from './lib/match.mjs';
import { createApi } from './lib/api.mjs';

function parseArgs(argv) {
  const args = {
    apiBase: process.env.GT_API_BASE ?? 'http://localhost:3000',
    email: process.env.GT_ADMIN_EMAIL ?? 'admin@golf.test',
    password: process.env.GT_ADMIN_PASSWORD ?? 'Admin123!',
    dryRun: false,
    force: false,
    fromJson: null
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--course-id') args.courseId = argv[++i];
    else if (a === '--club') args.club = argv[++i];
    else if (a === '--course') args.course = argv[++i];
    else if (a === '--api-base') args.apiBase = argv[++i];
    else if (a === '--email') args.email = argv[++i];
    else if (a === '--password') args.password = argv[++i];
    else if (a === '--from-json') args.fromJson = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.courseId) throw new Error('Missing --course-id');
  if (!args.club && !args.fromJson) throw new Error('Missing --club (or --from-json)');
  return args;
}

const args = parseArgs(process.argv);
const api = createApi(args.apiBase);
await api.login(args.email, args.password);
const course = await api.getCourse(args.courseId);
console.log(`Course: ${course.clubName} / ${course.courseName} (${course.holeCount} holes)`);

let entries;
if (args.fromJson) {
  entries = JSON.parse(readFileSync(args.fromJson, 'utf8')).holes;
} else {
  const jsonPath = fileURLToPath(new URL(`greens.${args.courseId}.json`, import.meta.url));
  const osm = parseOverpass(await fetchOverpass(buildOverpassQuery(args)));
  console.log(
    `OSM: ${osm.courseNames.length} course polygon(s), ${osm.holes.length} hole way(s), ${osm.greens.length} green(s)`
  );
  if (osm.holes.length === 0 && osm.greens.length === 0) {
    // Case C: nothing mapped. Leave a skeleton so trace.mjs --into works.
    writeFileSync(jsonPath, JSON.stringify({ courseId: args.courseId, club: args.club, holes: [] }, null, 2));
    console.error(
      `No golf=hole or golf=green in OSM for "${args.club}". Candidate course polygons: ${
        osm.courseNames.join(' | ') || 'none'
      }. Wrote empty ${jsonPath} — use the tracing workflow (README).`
    );
    process.exit(1);
  }
  const refs = osm.holes.map((h) => h.ref).filter(Boolean);
  const dupes = [...new Set(refs.filter((r, i) => refs.indexOf(r) !== i))];
  if (dupes.length > 0) {
    // Case B: ambiguous assignment. Dump the raw data for manual assignment.
    writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          courseId: args.courseId,
          club: args.club,
          holes: [],
          unassigned: { holeWays: osm.holes, greens: osm.greens }
        },
        null,
        2
      )
    );
    console.error(
      `Duplicate hole refs (${dupes.join(', ')}) — matched course polygon(s): ${osm.courseNames.join(' | ')}.` +
        (args.course
          ? ' --course did not isolate a single course.'
          : ' Narrow the search with --course.') +
        ` Raw ways/greens dumped to ${jsonPath} for manual assignment (see README).`
    );
    process.exit(1);
  }
  entries = matchGreens({ holes: osm.holes, greens: osm.greens, holeCount: course.holeCount });
  writeFileSync(jsonPath, JSON.stringify({ courseId: args.courseId, club: args.club, holes: entries }, null, 2));
  console.log(`Wrote ${jsonPath}`);
}

const report = [];
for (const e of entries) {
  try {
    const hole = course.holes.find((h) => h.holeNumber === e.holeNumber);
    if (!hole) {
      report.push({ hole: e.holeNumber, action: 'no-such-hole-in-db' });
      continue;
    }
    if (!e.polygon || e.status !== 'matched') {
      const action = e.status !== 'matched' ? (e.status ?? 'unmatched') : 'missing-polygon';
      report.push({ hole: e.holeNumber, action });
      continue;
    }
    const v = validateGreen(e.polygon);
    if (!v.ok) {
      report.push({ hole: e.holeNumber, action: 'failed-validation', detail: v.reasons.join('; ') });
      continue;
    }
    const existing = hole.layout.geometry;
    if (existing.greenPolygon.length > 0 && !args.force) {
      report.push({ hole: e.holeNumber, action: 'skipped-existing' });
      continue;
    }
    if (args.dryRun) {
      report.push({ hole: e.holeNumber, action: 'would-import', areaM2: v.area, distanceM: e.distanceM });
      continue;
    }
    // Merge-safe: replace ONLY greenPolygon, keep everything else verbatim.
    // v.ring is the normalized open ring — never PATCH e.polygon directly
    // (a hand-edited --from-json polygon may carry a closed ring, which would
    // bias the backend's vertex-averaged green center).
    await api.patchHoleLayout(args.courseId, e.holeNumber, {
      teePoint: existing.teePoint,
      greenPolygon: v.ring,
      fairwayPolygons: existing.fairwayPolygons ?? [],
      bunkerPolygons: existing.bunkerPolygons ?? [],
      treesPolygons: existing.treesPolygons ?? [],
      obPolygons: existing.obPolygons ?? []
    });
    report.push({ hole: e.holeNumber, action: 'imported', areaM2: v.area, distanceM: e.distanceM });
  } catch (err) {
    report.push({ hole: e?.holeNumber ?? '?', action: 'failed', detail: err.message });
  }
}

for (let n = 1; n <= course.holeCount; n++) {
  if (!report.some((r) => r.hole === n)) report.push({ hole: n, action: 'not-in-json' });
}
report.sort((a, b) => (Number.isFinite(a.hole) ? a.hole : 99) - (Number.isFinite(b.hole) ? b.hole : 99));

console.table(report);
const unresolved = report.filter(
  (r) => !['imported', 'would-import', 'skipped-existing'].includes(r.action)
);
if (unresolved.length > 0) {
  console.error(`${unresolved.length} hole(s) unresolved — see README for the fallback workflow.`);
  process.exitCode = 2;
}
