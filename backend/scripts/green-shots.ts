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

type LatLng = { lat: number; lng: number };

// Tee point as {lat,lng} (real format) or GeoJSON Point, else null.
function extractPoint(point: unknown): LatLng | null {
  if (!point || typeof point !== 'object') return null;
  const obj = point as { lat?: unknown; lng?: unknown };
  if (typeof obj.lat === 'number' && typeof obj.lng === 'number') return { lat: obj.lat, lng: obj.lng };
  const geom = ('geometry' in point ? (point as { geometry?: unknown }).geometry : point) as
    | { coordinates?: unknown }
    | undefined;
  const c = geom?.coordinates;
  if (Array.isArray(c) && c.length >= 2 && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))) {
    return { lng: Number(c[0]), lat: Number(c[1]) };
  }
  return null;
}

const bearingDeg = (from: LatLng, to: LatLng): number => {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

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

/**
 * Stitch the tiles around the green and centre-crop to `desiredSpanM`. When a
 * `bearing` (tee→green, degrees) is given, the image is rotated so the play
 * direction points UP (you always approach from the bottom). A larger area is
 * stitched first so the rotated crop has no black corners; sampling is bilinear.
 */
async function renderGreen(lat: number, lng: number, desiredSpanM: number, bearing: number | null) {
  const win = Math.max(64, Math.round(desiredSpanM / metresPerPx(lat, ZOOM))); // output px
  const rotate = bearing != null && Number.isFinite(bearing);
  const cover = rotate ? Math.ceil(win * Math.SQRT2) + 2 : win; // source coverage px

  const cpx = lngToPx(lng, ZOOM);
  const cpy = latToPx(lat, ZOOM);
  const minX = cpx - cover / 2;
  const minY = cpy - cover / 2;
  const tx0 = Math.floor(minX / TILE);
  const ty0 = Math.floor(minY / TILE);
  const tx1 = Math.floor((minX + cover) / TILE);
  const ty1 = Math.floor((minY + cover) / TILE);
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

  const originX = tx0 * TILE;
  const originY = ty0 * TILE;
  // Output "up" maps to the play direction; right = play dir rotated 90° CW.
  const B = rotate ? (bearing! * Math.PI) / 180 : 0;
  const cosB = Math.cos(B);
  const sinB = Math.sin(B);

  const png = new PNG({ width: win, height: win });
  for (let row = 0; row < win; row++) {
    for (let col = 0; col < win; col++) {
      const u = col - win / 2 + 0.5;
      const v = row - win / 2 + 0.5;
      const gx = cpx + u * cosB - v * sinB; // global pixel
      const gy = cpy + u * sinB + v * cosB;
      const lx = gx - originX;
      const ly = gy - originY;
      const di = (row * win + col) * 4;
      // Bilinear sample.
      const x0 = Math.floor(lx);
      const y0 = Math.floor(ly);
      if (x0 < 0 || y0 < 0 || x0 >= canvasW - 1 || y0 >= canvasH - 1) {
        png.data[di] = png.data[di + 1] = png.data[di + 2] = 0;
        png.data[di + 3] = 255;
        continue;
      }
      const fx = lx - x0;
      const fy = ly - y0;
      const i00 = (y0 * canvasW + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + canvasW * 4;
      const i11 = i01 + 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = canvas[i00 + ch] * (1 - fx) + canvas[i10 + ch] * fx;
        const bot = canvas[i01 + ch] * (1 - fx) + canvas[i11 + ch] * fx;
        png.data[di + ch] = Math.round(top * (1 - fy) + bot * fy);
      }
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

    // Rotate so the play direction (tee→green) points up. Prefer the stored
    // holeBearing; fall back to the tee→green-centre bearing; else no rotation.
    let bearing: number | null =
      layout.holeBearing != null && Number.isFinite(Number(layout.holeBearing))
        ? Number(layout.holeBearing)
        : null;
    if (bearing == null) {
      const tee = extractPoint(layout.teePoint);
      if (tee) bearing = bearingDeg(tee, { lat, lng });
    }

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

    const { buf, px } = await renderGreen(lat, lng, desiredSpanM, bearing);
    writeFileSync(resolve(OUT_DIR, file), buf);
    manifest.push({
      holeId: layout.holeId,
      club: course.clubName,
      course: course.courseName,
      holeNumber: layout.hole.holeNumber,
      file,
      center: [lat, lng],
      spanMeters: Math.round(desiredSpanM),
      bearing: bearing == null ? null : Math.round(bearing),
      px
    });
    ok++;
    console.log(`  ✓ ${file} (${px}px, ~${Math.round(desiredSpanM)}m, up=${bearing == null ? 'N' : Math.round(bearing) + '°'})`);
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
