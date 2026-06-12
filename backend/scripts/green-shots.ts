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
import { PNG } from 'pngjs';
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
const IMG_PX = 800; // MapTiler/Mapbox output pixels (square)
const MARGIN_M = 25; // metres of surroundings to keep around the green
const ESRI_MIN_SPAN_M = 280; // Esri's export 500s ("Error: bytes") below ~250m
const FETCH_PX = 800; // Esri export caps output (~800px); fetched then cropped tight
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
  // The tight view we actually want (green + ~MARGIN_M around).
  const desiredSpanM = Math.max(latSpanM, lngSpanM, 10) + 2 * MARGIN_M;
  // Esri export rejects tiny extents → fetch at a working minimum, crop later.
  const fetchSpanM = Math.max(desiredSpanM, ESRI_MIN_SPAN_M);

  // Zoom (for MapTiler/Mapbox) so the image width covers the desired span.
  const z = Math.log2((156543.03 * Math.cos((lat0 * Math.PI) / 180) * IMG_PX) / desiredSpanM);
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z)));

  // Square Web-Mercator bbox at the FETCH span (conformal → undistorted).
  // Mercator units stretch by 1/cos(lat), so scale the half-extent accordingly.
  const halfMerc = fetchSpanM / 2 / Math.cos((lat0 * Math.PI) / 180);
  const cx = toMercX(lng0);
  const cy = toMercY(lat0);
  const bbox3857: [number, number, number, number] = [cx - halfMerc, cy - halfMerc, cx + halfMerc, cy + halfMerc];
  return { lat0, lng0, zoom, desiredSpanM, fetchSpanM, bbox3857 };
}

/** Centre-crop a PNG buffer to `cropPx`×`cropPx` (clamped to the image). */
function cropCenter(buf: Buffer, cropPx: number): Buffer {
  const src = PNG.sync.read(buf);
  const size = Math.min(cropPx, src.width, src.height);
  const x0 = Math.floor((src.width - size) / 2);
  const y0 = Math.floor((src.height - size) / 2);
  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const si = ((y0 + y) * src.width + (x0 + x)) * 4;
      const di = (y * size + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return PNG.sync.write(out);
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
      `?bbox=${a},${b},${c},${d}&bboxSR=3857&imageSR=3857&size=${FETCH_PX},${FETCH_PX}&format=png32&f=image`
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
    const { lat0, lng0, desiredSpanM } = f;
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
        spanMeters: Math.round(desiredSpanM)
      });
      ok++;
      console.log(`  • ${file} → center ${lat0.toFixed(5)},${lng0.toFixed(5)} ~${Math.round(desiredSpanM)}m`);
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
    const raw = Buffer.from(await res.arrayBuffer());
    // Esri is fetched wide (≥280m) then centre-cropped to the tight desired span.
    let out = raw;
    if (PROVIDER === 'esri') {
      const cropPx = Math.max(256, Math.round(FETCH_PX * Math.min(1, f.desiredSpanM / f.fetchSpanM)));
      out = cropCenter(raw, cropPx);
    }
    writeFileSync(resolve(OUT_DIR, file), out);
    manifest.push({
      holeId: layout.holeId,
      club: course.clubName,
      course: course.courseName,
      holeNumber: layout.hole.holeNumber,
      file,
      center: [lat0, lng0],
      spanMeters: Math.round(desiredSpanM)
    });
    ok++;
    console.log(`  ✓ ${file} (~${Math.round(desiredSpanM)}m)`);
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
