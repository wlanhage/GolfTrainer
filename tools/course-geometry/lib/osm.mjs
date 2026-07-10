import { normalizeRing } from './geo.mjs';

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
(
  way(area.c)["golf"="hole"];
  way(area.c)["golf"="green"];
);
out geom;
.gc out tags;`;
}

// → { courseNames: string[], holes: [{ref, points}], greens: [{id, points}] }
export function parseOverpass(json) {
  const courseNames = [];
  const holes = [];
  const greens = [];
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
  }
  return { courseNames, holes, greens };
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
      return json;
    } catch (err) {
      lastErr = err;
      console.error(`Overpass attempt failed (${url}): ${err.message}`);
    }
  }
  throw new Error(`All Overpass endpoints failed. Last error: ${lastErr.message}`);
}
