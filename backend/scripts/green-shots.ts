// Generate a crisp satellite PNG for each mapped green by stitching Esri World
// Imagery TILES (the same source admin-web draws on) at native zoom, then
// centre-cropping to the green + ~MARGIN_M. No key, no card.
//
// (Esri's dynamic *export* endpoint serves poor imagery over Sweden; the cached
// *tile* pyramid is sharp — so we stitch tiles.)
//
// Attribution required where the images are shown: "Esri, Maxar, Earthstar
// Geographics, and the GIS User Community".
//
// Run:
//   npm --prefix backend run green:shots:supabase            # all mapped greens
//   npm --prefix backend run green:shots:supabase -- --dry-run   # list only
//
// Output: backend/green-shots/<club>__<course>__hole<N>.png + manifest.json

import dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE ?? '.env.supabase' });

import { PrismaClient } from '@prisma/client';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

const OUT_DIR = resolve(process.cwd(), 'green-shots');
const ZOOM = 19; // Esri's sharp native level over Sweden (z20 is upsampled)
const TILE = 256;
const MARGIN_M = 20; // metres of surroundings to keep around the green
const DRY_RUN = process.argv.includes('--dry-run');

const tileUrl = (z: number, x: number, y: number) =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

// ─── Green polygon parsing (real GeoPoint[] + GeoJSON fallbacks) ──────────────
type Ring = Array<[number, number]>; // [lng, lat]

const fromCoordPairs = (arr: unknown[]): Ring | null => {
  const ring = arr
    .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
    .map((p) => [Number(p[0]), Number(p[1])] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  return ring.length ? ring : null;
};

function extractRing(polygon: unknown): Ring | null {
  if (!polygon) return null;
  if (Array.isArray(polygon)) {
    const first = polygon[0];
    if (first && typeof first === 'object' && !Array.isArray(first) && 'lat' in first && 'lng' in first) {
      const ring = polygon
        .filter((p): p is { lat: number; lng: number } =>
          !!p && typeof (p as { lat?: unknown }).lat === 'number' && typeof (p as { lng?: unknown }).lng === 'number')
        .map((p) => [p.lng, p.lat] as [number, number]);
      return ring.length ? ring : null;
    }
    if (Array.isArray(first)) return fromCoordPairs(polygon);
    return null;
  }
  if (typeof polygon === 'object') {
    const geom = ('geometry' in polygon ? (polygon as { geometry?: unknown }).geometry : polygon) as
      | { coordinates?: unknown }
      | undefined;
    const coords = geom?.coordinates;
    if (Array.isArray(coords) && Array.isArray(coords[0])) return fromCoordPairs(coords[0] as unknown[]);
  }
  return null;
}

// ─── Slippy-map (Web-Mercator) pixel math ────────────────────────────────────
const lngToPx = (lng: number, z: number) => ((lng + 180) / 360) * TILE * 2 ** z;
const latToPx = (lat: number, z: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
};
const metresPerPx = (lat: number, z: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function fetchTileRGBA(z: number, x: number, y: number): Promise<Uint8Array | null> {
  const r = await fetch(tileUrl(z, x, y));
  if (!r.ok) return null;
  try {
    const { data } = jpeg.decode(Buffer.from(await r.arrayBuffer()), { useTArray: true });
    return data; // RGBA, TILE×TILE
  } catch {
    return null;
  }
}

/** Stitch the tiles covering green±margin and centre-crop to the desired span. */
async function renderGreen(lat: number, lng: number, desiredSpanM: number) {
  const win = Math.max(64, Math.round(desiredSpanM / metresPerPx(lat, ZOOM))); // output px
  const minX = lngToPx(lng, ZOOM) - win / 2;
  const minY = latToPx(lat, ZOOM) - win / 2;
  const tx0 = Math.floor(minX / TILE);
  const ty0 = Math.floor(minY / TILE);
  const tx1 = Math.floor((minX + win) / TILE);
  const ty1 = Math.floor((minY + win) / TILE);
  const canvasW = (tx1 - tx0 + 1) * TILE;
  const canvasH = (ty1 - ty0 + 1) * TILE;
  const canvas = new Uint8Array(canvasW * canvasH * 4);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const tile = await fetchTileRGBA(ZOOM, tx, ty);
      if (!tile) continue;
      const ox = (tx - tx0) * TILE;
      const oy = (ty - ty0) * TILE;
      for (let row = 0; row < TILE; row++) {
        const src = row * TILE * 4;
        const dst = ((oy + row) * canvasW + ox) * 4;
        canvas.set(tile.subarray(src, src + TILE * 4), dst);
      }
    }
  }

  const sx = Math.round(minX - tx0 * TILE);
  const sy = Math.round(minY - ty0 * TILE);
  const png = new PNG({ width: win, height: win });
  for (let row = 0; row < win; row++) {
    for (let col = 0; col < win; col++) {
      const si = ((sy + row) * canvasW + (sx + col)) * 4;
      const di = (row * win + col) * 4;
      png.data[di] = canvas[si];
      png.data[di + 1] = canvas[si + 1];
      png.data[di + 2] = canvas[si + 2];
      png.data[di + 3] = 255;
    }
  }
  return { buf: PNG.sync.write(png), px: win };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const layouts = await prisma.holeLayout.findMany({
    where: { greenPolygon: { not: null } },
    include: { hole: { include: { course: true } } }
  });
  console.log(`[green-shots] ${layouts.length} mapped green(s) found.`);

  const manifest: Array<Record<string, unknown>> = [];
  let ok = 0;

  for (const layout of layouts) {
    const ring = extractRing(layout.greenPolygon);
    if (!ring) {
      console.warn(`  skip hole ${layout.hole.holeNumber}: green polygon unparseable`);
      continue;
    }
    const lats = ring.map(([, lat]) => lat);
    const lngs = ring.map(([lng]) => lng);
    const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const latM = (Math.max(...lats) - Math.min(...lats)) * 111320;
    const lngM = (Math.max(...lngs) - Math.min(...lngs)) * 111320 * Math.cos((lat * Math.PI) / 180);
    const desiredSpanM = Math.max(latM, lngM, 12) + 2 * MARGIN_M;

    const course = layout.hole.course;
    const file = `${slug(course.clubName)}__${slug(course.courseName)}__hole${layout.hole.holeNumber}.png`;

    if (DRY_RUN) {
      manifest.push({
        holeId: layout.holeId,
        club: course.clubName,
        course: course.courseName,
        holeNumber: layout.hole.holeNumber,
        file,
        center: [lat, lng],
        spanMeters: Math.round(desiredSpanM)
      });
      ok++;
      console.log(`  • ${file} → ${lat.toFixed(5)},${lng.toFixed(5)} ~${Math.round(desiredSpanM)}m`);
      continue;
    }

    const { buf, px } = await renderGreen(lat, lng, desiredSpanM);
    writeFileSync(resolve(OUT_DIR, file), buf);
    manifest.push({
      holeId: layout.holeId,
      club: course.clubName,
      course: course.courseName,
      holeNumber: layout.hole.holeNumber,
      file,
      center: [lat, lng],
      spanMeters: Math.round(desiredSpanM),
      px
    });
    ok++;
    console.log(`  ✓ ${file} (${px}px, ~${Math.round(desiredSpanM)}m)`);
  }

  writeFileSync(resolve(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[green-shots] wrote ${ok} image(s) + manifest.json → ${OUT_DIR}`);
}

main()
  .catch((err) => {
    console.error('[green-shots] error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
