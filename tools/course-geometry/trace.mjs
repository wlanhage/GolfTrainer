#!/usr/bin/env node
// Turn traced pixel coordinates on a snap into a green polygon in a
// greens.<courseId>.json — or render letter marks for the ask-the-user
// numbering fallback.
//
// Usage:
//   node trace.mjs snap.<name>.json --hole 7 --points "x,y x,y x,y ..." --into greens.<courseId>.json
//   node trace.mjs snap.<name>.json --mark "A:x,y B:x,y" [--out marked.png]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pixelsToPolygon, parseMarks } from './lib/georef.mjs';
import { validateGreen } from './lib/match.mjs';
import { tileGridHtml, renderPagesToPngs } from './lib/tiles.mjs';

function parseArgs(argv) {
  const args = { snap: argv[2] };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--hole') args.hole = Number(argv[++i]);
    else if (a === '--points') args.points = argv[++i];
    else if (a === '--into') args.into = argv[++i];
    else if (a === '--mark') args.mark = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.snap || args.snap.startsWith('--')) {
    throw new Error('Usage: node trace.mjs snap.<name>.json (--hole N --points "x,y ..." --into greens.json | --mark "A:x,y ...")');
  }
  if (!args.mark && !(Number.isInteger(args.hole) && args.hole >= 1 && args.points && args.into)) {
    throw new Error('Need either --mark "A:x,y ..." or all of: --hole N --points "x,y x,y x,y" --into greens.<courseId>.json');
  }
  return args;
}

const args = parseArgs(process.argv);
const georef = JSON.parse(readFileSync(args.snap, 'utf8'));

if (args.mark) {
  const marks = parseMarks(args.mark);
  const overlay = marks
    .map(
      (m) =>
        `<circle cx="${m.x}" cy="${m.y}" r="14" fill="rgba(255,80,80,.35)" stroke="#ff5050" stroke-width="2"/>` +
        `<text x="${m.x}" y="${m.y + 6}" text-anchor="middle" style="font:bold 16px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px">${m.label}</text>`
    )
    .join('');
  const out = args.out ?? args.snap.replace(/\.json$/, '.marked.png');
  await renderPagesToPngs([{ html: tileGridHtml(georef, overlay), outPath: out }]);
} else {
  const polygon = pixelsToPolygon(georef, args.points);
  const v = validateGreen(polygon);
  if (!v.ok) {
    console.error(`Refusing hole ${args.hole}: ${v.reasons.join('; ')}`);
    process.exit(1);
  }
  if (!existsSync(args.into)) {
    throw new Error(`${args.into} not found — run import-greens.mjs --dry-run first to create it`);
  }
  const data = JSON.parse(readFileSync(args.into, 'utf8'));
  if (!Array.isArray(data.holes)) throw new Error(`${args.into} has no holes array`);
  const entry = { holeNumber: args.hole, status: 'matched', source: 'traced', polygon: v.ring };
  const idx = data.holes.findIndex((h) => h?.holeNumber === args.hole);
  if (idx >= 0) data.holes[idx] = entry;
  else data.holes.push(entry);
  writeFileSync(args.into, JSON.stringify(data, null, 2));
  console.log(`hole ${args.hole}: ${v.ring.length} pts, ${v.area} m² -> ${args.into}`);
}
