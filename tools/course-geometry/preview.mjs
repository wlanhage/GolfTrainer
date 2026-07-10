#!/usr/bin/env node
// Render one PNG per hole: Esri satellite tiles + the green polygon overlay.
//
// Usage: node preview.mjs greens.<courseId>.json [outDir]
//
// Reuses the Playwright install from ../pr-screenshots (npm install there once).
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lngLatToWorldPixel } from './lib/geo.mjs';
import { tileGridHtml, renderPagesToPngs } from './lib/tiles.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const ZOOM = 19;
const MARGIN_PX = 60;

function pageForHole(entry) {
  const px = entry.polygon.map((p) => lngLatToWorldPixel(p, ZOOM));
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
  return tileGridHtml({ zoom: ZOOM, originX, originY, widthPx, heightPx }, overlay);
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Usage: node preview.mjs greens.<courseId>.json [outDir]');
  process.exit(1);
}
const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
const outDir = process.argv[3] ?? `${here}/out`;
mkdirSync(outDir, { recursive: true });

const pages = data.holes
  .filter((h) => h?.polygon)
  .map((entry) => ({
    html: pageForHole(entry),
    outPath: `${outDir}/hole-${String(entry.holeNumber).padStart(2, '0')}.png`
  }));
await renderPagesToPngs(pages);

const skipped = data.holes.filter((h) => !h?.polygon).map((h) => h?.holeNumber ?? '?');
if (skipped.length > 0) console.log(`No polygon (not rendered): holes ${skipped.join(', ')}`);
