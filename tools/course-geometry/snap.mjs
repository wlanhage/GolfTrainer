#!/usr/bin/env node
// Georeferenced satellite snapshot the agent can trace on.
//
// Usage:
//   node snap.mjs --center <lat,lng> [--zoom 19] [--grid 3] [--name <name>]
//   node snap.mjs --club "<klubb>" [--course "<bana>"] --overview [--name <name>]
//
// Writes snap.<name>.png + snap.<name>.json (the georef sidecar trace.mjs
// needs to convert pixel coordinates back to lat/lng).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeGeorefFromCenter, makeGeorefFromBounds } from './lib/georef.mjs';
import { tileGridHtml, renderPagesToPngs } from './lib/tiles.mjs';
import { buildCourseBoundsQuery, parseCourseBounds, fetchOverpass } from './lib/osm.mjs';

function parseArgs(argv) {
  const args = { zoom: 19, grid: 3, overview: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--center') args.center = argv[++i];
    else if (a === '--zoom') args.zoom = Number(argv[++i]);
    else if (a === '--grid') args.grid = Number(argv[++i]);
    else if (a === '--club') args.club = argv[++i];
    else if (a === '--course') args.course = argv[++i];
    else if (a === '--overview') args.overview = true;
    else if (a === '--name') args.name = argv[++i];
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!Number.isInteger(args.zoom) || args.zoom < 12 || args.zoom > 19) {
    throw new Error(`--zoom must be an integer 12-19, got ${args.zoom}`);
  }
  if (!Number.isInteger(args.grid)) {
    throw new Error(`--grid must be an integer, got ${args.grid}`);
  }
  if (!args.center && !(args.club && args.overview)) {
    throw new Error('Need --center <lat,lng> or --club "<name>" --overview');
  }
  if (args.center && args.overview) {
    throw new Error('--center and --overview are mutually exclusive');
  }
  return args;
}

const args = parseArgs(process.argv);
const here = fileURLToPath(new URL('.', import.meta.url));

let georef;
let defaultName;
if (args.center) {
  const m = String(args.center).match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) throw new Error(`bad --center "${args.center}" — expected "lat,lng"`);
  georef = makeGeorefFromCenter({ lat: Number(m[1]), lng: Number(m[2]) }, args.zoom, args.grid);
  defaultName = `${m[1]}_${m[2]}_z${args.zoom}`;
} else {
  const courses = parseCourseBounds(await fetchOverpass(buildCourseBoundsQuery(args)));
  if (courses.length === 0) {
    console.error(`No leisure=golf_course matched "${args.club}"${args.course ? ` + "${args.course}"` : ''}.`);
    process.exit(1);
  }
  if (courses.length > 1) {
    console.error(`Several courses matched: ${courses.map((c) => c.name).join(' | ')}. Narrow with --course.`);
    process.exit(1);
  }
  if (args.zoom !== 19 || args.grid !== 3) {
    console.error('note: --zoom/--grid are ignored in --overview mode (zoom is auto-picked to fit the course)');
  }
  georef = makeGeorefFromBounds(courses[0].bounds);
  defaultName = courses[0].name.toLowerCase().replace(/[^a-z0-9åäö]+/g, '-');
}

const name = args.name ?? defaultName;
const png = `${here}snap.${name}.png`;
const sidecar = `${here}snap.${name}.json`;
await renderPagesToPngs([{ html: tileGridHtml(georef), outPath: png }]);
writeFileSync(sidecar, JSON.stringify(georef, null, 2));
console.log(sidecar);
console.log(`zoom ${georef.zoom}, ${georef.widthPx}x${georef.heightPx} px, origin ${georef.originX},${georef.originY}`);
