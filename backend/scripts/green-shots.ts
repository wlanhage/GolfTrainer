// Generate a clean satellite PNG for each mapped green (green + ~20 m around)
// using a Static Maps API. Reads green polygons straight from the DB.
//
// Default provider is MapTiler (free, no credit card). Set TILE_PROVIDER=mapbox
// to use Mapbox instead.
//
// Run (key inline so it isn't committed):
//   MAPTILER_KEY=xxx npm --prefix backend run green:shots:supabase
//   MAPTILER_KEY=xxx npm --prefix backend run green:shots:local
//   TILE_PROVIDER=mapbox MAPBOX_TOKEN=pk.xxx npm --prefix backend run green:shots:supabase
//
// Output: backend/green-shots/<club>__<course>__hole<N>.png + manifest.json

import dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE ?? '.env.supabase' });

import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

type Provider = 'maptiler' | 'mapbox';
const PROVIDER: Provider = process.env.TILE_PROVIDER === 'mapbox' ? 'mapbox' : 'maptiler';
const KEY = PROVIDER === 'mapbox' ? process.env.MAPBOX_TOKEN : process.env.MAPTILER_KEY;
const KEY_NAME = PROVIDER === 'mapbox' ? 'MAPBOX_TOKEN' : 'MAPTILER_KEY';

const OUT_DIR = resolve(process.cwd(), 'green-shots');
const IMG_PX = 600; // requested at @2x → 1200×1200 actual
const MARGIN_M = 22; // metres of surroundings to include on each side
const ZOOM_MIN = 16;
const ZOOM_MAX = 20; // satellite imagery thins out past this in rural areas

type Ring = Array<[number, number]>; // [lng, lat]

const fromCoordPairs = (arr: unknown[]): Ring | null => {
  const ring = arr
    .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
    .map((p) => [Number(p[0]), Number(p[1])] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  return ring.length ? ring : null;
};

// Handles the real DB format (GeoPoint[] = [{lat,lng}, ...]) plus GeoJSON
// fallbacks ([[lng,lat], ...] and { coordinates: [[[lng,lat], ...]] }).
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

function frame(ring: Ring) {
  const lats = ring.map(([, lat]) => lat);
  const lngs = ring.map(([lng]) => lng);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lng0 = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const latSpanM = (Math.max(...lats) - Math.min(...lats)) * 111320;
  const lngSpanM = (Math.max(...lngs) - Math.min(...lngs)) * 111320 * Math.cos((lat0 * Math.PI) / 180);
  const spanM = Math.max(latSpanM, lngSpanM, 10) + 2 * MARGIN_M;
  // Zoom so the image width covers spanM: mpp = 156543.03·cos(lat)/2^z, span = px·mpp
  const z = Math.log2((156543.03 * Math.cos((lat0 * Math.PI) / 180) * IMG_PX) / spanM);
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z)));
  return { lat0, lng0, zoom };
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function buildUrl(lng: number, lat: number, zoom: number): string {
  if (PROVIDER === 'mapbox') {
    return (
      `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
      `${lng},${lat},${zoom},0/${IMG_PX}x${IMG_PX}@2x?access_token=${KEY}`
    );
  }
  // MapTiler (default)
  return (
    `https://api.maptiler.com/maps/satellite/static/` +
    `${lng},${lat},${zoom}/${IMG_PX}x${IMG_PX}@2x.png?key=${KEY}`
  );
}

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  if (!DRY_RUN && !KEY) throw new Error(`Missing ${KEY_NAME} env var (or pass --dry-run).`);
  console.log(`[green-shots] provider: ${PROVIDER}`);
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
    const { lat0, lng0, zoom } = frame(ring);
    const course = layout.hole.course;
    const file = `${slug(course.clubName)}__${slug(course.courseName)}__hole${layout.hole.holeNumber}.png`;

    const url = buildUrl(lng0, lat0, zoom);

    if (DRY_RUN) {
      manifest.push({
        holeId: layout.holeId,
        club: course.clubName,
        course: course.courseName,
        holeNumber: layout.hole.holeNumber,
        file,
        center: [lat0, lng0],
        zoom
      });
      ok++;
      console.log(`  • ${file} → center ${lat0.toFixed(5)},${lng0.toFixed(5)} zoom ${zoom}`);
      continue;
    }

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  fail ${file}: HTTP ${res.status} ${await res.text().catch(() => '')}`.trim());
      continue;
    }
    writeFileSync(resolve(OUT_DIR, file), Buffer.from(await res.arrayBuffer()));
    manifest.push({
      holeId: layout.holeId,
      club: course.clubName,
      course: course.courseName,
      holeNumber: layout.hole.holeNumber,
      file,
      center: [lat0, lng0],
      zoom
    });
    ok++;
    console.log(`  ✓ ${file} (zoom ${zoom})`);
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
