import { normalizeRing, centroid } from './geo.mjs';

// overpass.kumi.systems is gone (CNAME to private.coffee since 2026), and
// overpass-api.de sits behind DNS round-robin where a single broken server
// can answer HTTP 406 to everything — so keep several independent mirrors.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

// --club / --course are used as case-insensitive Overpass regexes; escape
// only quotes and backslashes so simple names work verbatim.
const esc = (s) => s.replace(/["\\]/g, '\\$&');

export function buildOverpassQuery({ club, course }) {
  // Overpass's `,i` flag does not case-fold non-ASCII (å/ä/ö) — names must
  // match those characters' case as typed.
  const nameFilters =
    `["name"~"${esc(club)}",i]` + (course ? `["name"~"${esc(course)}",i]` : '');
  return `[out:json][timeout:60];
area["ISO3166-1"="SE"][admin_level=2]->.se;
(
  way(area.se)["leisure"="golf_course"]${nameFilters};
  relation(area.se)["leisure"="golf_course"]${nameFilters};
)->.gc;
.gc map_to_area ->.c;
// area.c only covers the golf_course boundary polygon, which OSM mappers
// sometimes draw too tight — union with around.gc:150 to also catch
// greens/tees mapped just outside a sloppy boundary (dedup is automatic).
(
  way(area.c)["golf"="hole"];
  way(around.gc:150)["golf"="hole"];
  way(area.c)["golf"="green"];
  way(around.gc:150)["golf"="green"];
  way(area.c)["golf"="tee"];
  way(around.gc:150)["golf"="tee"];
  node(area.c)["golf"="tee"];
  node(around.gc:150)["golf"="tee"];
);
out geom;
.gc out tags;`;
}

// → { courseNames: string[], holes: [{ref, points}], greens: [{id, points}], tees: [{id, point, ref, name}] }
export function parseOverpass(json) {
  const courseNames = [];
  const holes = [];
  const greens = [];
  const tees = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    if (tags.leisure === 'golf_course') {
      courseNames.push(tags.name ?? `${el.type}/${el.id}`);
      continue;
    }
    const points = (el.geometry ?? []).filter(Boolean).map((g) => ({ lat: g.lat, lng: g.lon }));
    if (tags.golf === 'hole') holes.push({ ref: tags.ref ?? null, points });
    else if (tags.golf === 'green')
      greens.push({ id: `${el.type}/${el.id}`, points: normalizeRing(points) });
    else if (tags.golf === 'tee') {
      const point =
        el.type === 'node' && Number.isFinite(el.lat)
          ? { lat: el.lat, lng: el.lon }
          : points.length > 0
            ? centroid(normalizeRing(points))
            : null;
      if (point) tees.push({ id: `${el.type}/${el.id}`, point, ref: tags.ref ?? null, name: tags.name ?? null });
    }
  }
  return { courseNames, holes, greens, tees };
}

export async function fetchOverpass(query) {
  let lastErr;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(90_000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      const json = await res.json();
      // Overpass can return HTTP 200 with a `remark` (e.g. query timeout)
      // and a partial elements array — treat that as failure so we retry
      // against the mirror.
      if (json.remark) throw new Error(`Overpass remark from ${url}: ${json.remark}`);
      console.error(`Overpass: served by ${url}`);
      if (url !== ENDPOINTS[0]) {
        console.error(`Overpass: primary failed, served by mirror ${url} — data may be less fresh`);
      }
      return json;
    } catch (err) {
      lastErr = err;
      console.error(`Overpass attempt failed (${url}): ${err.message}`);
    }
  }
  throw new Error(`All Overpass endpoints failed. Last error: ${lastErr.message}`);
}

// Bounds-only lookup of a club's golf_course polygon(s) — works even when
// the club has no holes/greens mapped. Used by snap.mjs --overview.
export function buildCourseBoundsQuery({ club, course }) {
  const nameFilters =
    `["name"~"${esc(club)}",i]` + (course ? `["name"~"${esc(course)}",i]` : '');
  return `[out:json][timeout:30];
area["ISO3166-1"="SE"][admin_level=2]->.se;
(
  way(area.se)["leisure"="golf_course"]${nameFilters};
  relation(area.se)["leisure"="golf_course"]${nameFilters};
);
out tags bb;`;
}

// → [{ name, bounds: {minLat, minLng, maxLat, maxLng} }]
export function parseCourseBounds(json) {
  return (json.elements ?? [])
    .filter((el) => el.bounds)
    .map((el) => ({
      name: el.tags?.name ?? `${el.type}/${el.id}`,
      bounds: {
        minLat: el.bounds.minlat,
        minLng: el.bounds.minlon,
        maxLat: el.bounds.maxlat,
        maxLng: el.bounds.maxlon
      }
    }));
}
