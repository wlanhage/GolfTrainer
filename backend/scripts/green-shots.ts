// Generate a clean satellite PNG for each mapped green (green + ~20 m around).
// Reads green polygons straight from the DB.
//
// Default provider is Esri World Imagery — NO key, NO credit card. (MapTiler's
// and Mapbox's static-image APIs need a paid/keyed plan.) Attribution required
// where the images are shown: "Esri, Maxar, Earthstar Geographics, and the GIS
// User Community".
//
// Run:
//   npm --prefix backend run green:shots:supabase                       # Esri, no key
//   TILE_PROVIDER=maptiler MAPTILER_KEY=xxx  npm --prefix backend run green:shots:supabase
//   TILE_PROVIDER=mapbox   MAPBOX_TOKEN=pk.x npm --prefix backend run green:shots:supabase
//
// Output: backend/green-shots/<club>__<course>__hole<N>.png + manifest.json

import dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE ?? '.env.supabase' });

import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

type Provider = 'esri' | 'maptiler' | 'mapbox';
const PROVIDER: Provider =
  process.env.TILE_PROVIDER === 'maptiler' ? 'maptiler'
  : process.env.TILE_PROVIDER === 'mapbox' ? 'mapbox'
  : 'esri';
const KEY = PROVIDER === 'mapbox' ? process.env.MAPBOX_TOKEN : process.env.MAPTILER_KEY;
const KEY_NAME = PROVIDER === 'mapbox' ? 'MAPBOX_TOKEN' : 'MAPTILER_KEY';
const NEEDS_KEY = PROVIDER !== 'esri';

const OUT_DIR = resolve(process.cwd(), 'green-shots');
const IMG_PX = 800; // output pixels (square)
const MARGIN_M = 22; // metres of surroundings to include on each side
const ESRI_MIN_SPAN_M = 280; // Esri's export 500s ("Error: bytes") below ~250m
const ZOOM_MIN = 16;
const ZOOM_MAX = 20; // satellite imagery thins out past this in rural areas

// Web-Mercator (EPSG:3857) helpers.
const MERC = 20037508.34 / 180;
const toMercX = (lng: number) => lng * MERC;
const toMercY = (lat: number) => Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * MERC;

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
  const greenSpanM = Math.max(latSpanM, lngSpanM, 10) + 2 * MARGIN_M;
  // Esri export rejects tiny extents → clamp to a working minimum.
  const spanM = Math.max(greenSpanM, ESRI_MIN_SPAN_M);

  // Zoom (for MapTiler/Mapbox) so the image width covers spanM.
  const z = Math.log2((156543.03 * Math.cos((lat0 * Math.PI) / 180) * IMG_PX) / spanM);
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z)));

  // Square Web-Mercator bbox (conformal → undistorted square image). Mercator
  // units stretch by 1/cos(lat), so scale the half-extent accordingly.
  const halfMerc = spanM / 2 / Math.cos((lat0 * Math.PI) / 180);
  const cx = toMercX(lng0);
  const cy = toMercY(lat0);
  const bbox3857: [number, number, number, number] = [cx - halfMerc, cy - halfMerc, cx + halfMerc, cy + halfMerc];
  return { lat0, lng0, zoom, spanM, bbox3857 };
}

type Frame = ReturnType<typeof frame>;

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function buildUrl(f: Frame): string {
  if (PROVIDER === 'esri') {
    const [a, b, c, d] = f.bbox3857;
    return (
      `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export` +
      `?bbox=${a},${b},${c},${d}&bboxSR=3857&imageSR=3857&size=${IMG_PX},${IMG_PX}&format=png&f=image`
    );
  }
  if (PROVIDER === 'mapbox') {
    return (
      `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
      `${f.lng0},${f.lat0},${f.zoom},0/${IMG_PX}x${IMG_PX}@2x?access_token=${KEY}`
    );
  }
  return (
    `https://api.maptiler.com/maps/satellite/static/` +
    `${f.lng0},${f.lat0},${f.zoom}/${IMG_PX}x${IMG_PX}@2x.png?key=${KEY}`
  );
}

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  if (!DRY_RUN && NEEDS_KEY && !KEY) throw new Error(`Missing ${KEY_NAME} env var (or pass --dry-run).`);
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
    const f = frame(ring);
    const { lat0, lng0, zoom, spanM } = f;
    const course = layout.hole.course;
    const file = `${slug(course.clubName)}__${slug(course.courseName)}__hole${layout.hole.holeNumber}.png`;

    const url = buildUrl(f);

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
      console.log(`  • ${file} → center ${lat0.toFixed(5)},${lng0.toFixed(5)} ~${Math.round(spanM)}m`);
      continue;
    }

    const res = await fetch(url);
    if (res.status === 401 || res.status === 403) {
      // Key problem — no point hammering the rest.
      throw new Error(
        `${KEY_NAME} rejected (HTTP ${res.status}). Verify the key is correct and has no ` +
          `allowed-origins/URL restriction (server-side requests need an unrestricted key).`
      );
    }
    if (!res.ok) {
      // Only read the body as text when it's JSON — error "tiles" are binary
      // PNGs and would spew garbage to the terminal.
      const ct = res.headers.get('content-type') ?? '';
      const detail = ct.includes('json') ? ` — ${(await res.text().catch(() => '')).slice(0, 200)}` : '';
      console.warn(`  fail hole ${layout.hole.holeNumber}: HTTP ${res.status}${detail}`);
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
