#!/usr/bin/env node
// Render one PNG per hole: Esri satellite tiles + the green polygon overlay.
//
// Usage: node preview.mjs greens.<courseId>.json [outDir]
//
// Reuses the Playwright install from ../pr-screenshots (npm install there once).
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lngLatToWorldPixel } from './lib/geo.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(new URL('../pr-screenshots/package.json', import.meta.url));
const { chromium } = require('playwright');

const ZOOM = 19;
const TILE = 256;
const MARGIN_PX = 60;

function pageForHole(entry) {
  const px = entry.polygon.map((p) => lngLatToWorldPixel(p, ZOOM));
  const minX = Math.min(...px.map((p) => p.x)) - MARGIN_PX;
  const maxX = Math.max(...px.map((p) => p.x)) + MARGIN_PX;
  const minY = Math.min(...px.map((p) => p.y)) - MARGIN_PX;
  const maxY = Math.max(...px.map((p) => p.y)) + MARGIN_PX;
  const width = Math.ceil(maxX - minX);
  const height = Math.ceil(maxY - minY);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`hole ${entry.holeNumber}: bad polygon (non-numeric coordinates)`);
  }
  const imgs = [];
  for (let tx = Math.floor(minX / TILE); tx <= Math.floor(maxX / TILE); tx++) {
    for (let ty = Math.floor(minY / TILE); ty <= Math.floor(maxY / TILE); ty++) {
      imgs.push(
        `<img src="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${ZOOM}/${ty}/${tx}"` +
          ` style="position:absolute;left:${tx * TILE - minX}px;top:${ty * TILE - minY}px;width:${TILE}px;height:${TILE}px">`
      );
    }
  }
  const pts = px.map((p) => `${(p.x - minX).toFixed(1)},${(p.y - minY).toFixed(1)}`).join(' ');
  const label = `Hål ${entry.holeNumber}${entry.status && entry.status !== 'matched' ? ` (${entry.status})` : ''}`;
  return `<!doctype html><body style="margin:0;position:relative;width:${width}px;height:${height}px;background:#000">
${imgs.join('\n')}
<svg width="${width}" height="${height}" style="position:absolute;left:0;top:0">
  <polygon points="${pts}" fill="rgba(80,220,120,.25)" stroke="#3ddc84" stroke-width="2"/>
  <text x="8" y="22" style="font:bold 15px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px">${label}</text>
</svg></body>`;
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Usage: node preview.mjs greens.<courseId>.json [outDir]');
  process.exit(1);
}
const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
const outDir = process.argv[3] ?? `${here}/out`;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
for (const entry of data.holes.filter((h) => h?.polygon)) {
  await page.setContent(pageForHole(entry), { waitUntil: 'networkidle' });
  const file = `${outDir}/hole-${String(entry.holeNumber).padStart(2, '0')}.png`;
  await page.locator('body').screenshot({ path: file });
  console.log(file);
}
await browser.close();
const skipped = data.holes.filter((h) => !h?.polygon).map((h) => h?.holeNumber);
if (skipped.length > 0) console.log(`No polygon (not rendered): holes ${skipped.join(', ')}`);
