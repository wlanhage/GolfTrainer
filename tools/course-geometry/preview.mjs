#!/usr/bin/env node
// Render one PNG per hole: Esri satellite tiles + the green polygon overlay.
//
// Usage: node preview.mjs greens.<courseId>.json [outDir] [--zoom 16-19]
//
// Reuses the Playwright install from ../pr-screenshots (npm install there once).
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lngLatToWorldPixel } from './lib/geo.mjs';
import { tileGridHtml, renderPagesToPngs } from './lib/tiles.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const MARGIN_PX = 60;
const USAGE = 'Usage: node preview.mjs greens.<courseId>.json [outDir] [--zoom 16-19]';

function parseArgs(argv) {
  const args = { zoom: 19, positional: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--zoom') args.zoom = Number(argv[++i]);
    else args.positional.push(a);
  }
  if (!Number.isInteger(args.zoom) || args.zoom < 16 || args.zoom > 19) {
    throw new Error(`--zoom must be an integer 16-19, got ${args.zoom}`);
  }
  return args;
}

function pageForHole(entry, zoom) {
  const px = entry.polygon.map((p) => lngLatToWorldPixel(p, zoom));
  const originX = Math.min(...px.map((p) => p.x)) - MARGIN_PX;
  const originY = Math.min(...px.map((p) => p.y)) - MARGIN_PX;
  const widthPx = Math.ceil(Math.max(...px.map((p) => p.x)) + MARGIN_PX - originX);
  const heightPx = Math.ceil(Math.max(...px.map((p) => p.y)) + MARGIN_PX - originY);
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx)) {
    throw new Error(`hole ${entry.holeNumber}: bad polygon (non-numeric coordinates)`);
  }
  const pts = px.map((p) => `${(p.x - originX).toFixed(1)},${(p.y - originY).toFixed(1)}`).join(' ');
  const label = `Hål ${entry.holeNumber}${entry.status && entry.status !== 'matched' ? ` (${entry.status})` : ''}`;
  const overlay =
    `<polygon points="${pts}" fill="rgba(80,220,120,.25)" stroke="#3ddc84" stroke-width="2"/>` +
    `<text x="8" y="22" style="font:bold 15px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px">${label}</text>`;
  return tileGridHtml({ zoom, originX, originY, widthPx, heightPx }, overlay);
}

const args = parseArgs(process.argv);
const jsonPath = args.positional[0];
if (!jsonPath) {
  console.error(USAGE);
  process.exit(1);
}
const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
const explicitOutDir = args.positional[1];
const outDir = explicitOutDir ?? (data.courseId ? `${here}/out/${data.courseId}` : `${here}/out`);
mkdirSync(outDir, { recursive: true });

const pages = data.holes
  .filter((h) => h?.polygon)
  .map((entry) => ({
    html: pageForHole(entry, args.zoom),
    outPath: `${outDir}/hole-${String(entry.holeNumber).padStart(2, '0')}.png`
  }));
await renderPagesToPngs(pages);

const skipped = data.holes.filter((h) => !h?.polygon).map((h) => h?.holeNumber ?? '?');
if (skipped.length > 0) console.log(`No polygon (not rendered): holes ${skipped.join(', ')}`);
