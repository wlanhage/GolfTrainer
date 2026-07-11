import { haversineMeters, centroid, polygonAreaM2, normalizeRing } from './geo.mjs';

export const MAX_GREEN_DISTANCE_M = 80;
export const AMBIGUITY_MARGIN_M = 20;
export const MIN_AREA_M2 = 150;
export const MAX_AREA_M2 = 1500;

export const TEE_BAND_MIN = 0.75; // scorecard length is play-line; straight tee→green is shorter on doglegs
export const TEE_BAND_MAX = 1.05;
export const TEE_TIE_MARGIN_M = 15;
export const TEE_TIE_SPREAD_M = 30;

export function validateGreen(points) {
  if (!Array.isArray(points) || !points.every((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))) {
    return { ok: false, area: 0, reasons: ['non-numeric coordinates'], ring: [] };
  }
  const ring = normalizeRing(points);
  const area = Math.round(polygonAreaM2(ring));
  const reasons = [];
  // open-ring minimum; equals the spec's "≥4 vertices" for closed rings
  if (ring.length < 3) reasons.push(`only ${ring.length} vertices`);
  if (area < MIN_AREA_M2 || area > MAX_AREA_M2)
    reasons.push(`area ${area} m² outside ${MIN_AREA_M2}-${MAX_AREA_M2} m²`);
  return { ok: reasons.length === 0, area, reasons, ring };
}

// Pick the tee whose straight-line distance to the green center best matches
// the scorecard length. Returns {point, distanceM, teeId}, or
// {reason: 'ambiguous-tees'} when two far-apart tees fit equally well, or
// null when nothing lands in the band / inputs are unusable.
export function pickTee({ tees, greenCenter, holeLengthM }) {
  if (!tees?.length || !greenCenter || !Number.isFinite(holeLengthM) || holeLengthM <= 0) return null;
  const candidates = tees
    .map((t) => ({ t, d: haversineMeters(t.point, greenCenter) }))
    .filter(({ d }) => d >= TEE_BAND_MIN * holeLengthM && d <= TEE_BAND_MAX * holeLengthM)
    .sort((a, b) => Math.abs(a.d - holeLengthM) - Math.abs(b.d - holeLengthM));
  const best = candidates[0];
  if (!best) return null;
  // Refuse when ANY far-apart rival fits nearly as well — adjacent pads
  // (< TEE_TIE_SPREAD_M apart) are the same tee area and never block.
  const rival = candidates
    .slice(1)
    .find(
      (c) =>
        Math.abs(c.d - holeLengthM) - Math.abs(best.d - holeLengthM) < TEE_TIE_MARGIN_M &&
        haversineMeters(best.t.point, c.t.point) > TEE_TIE_SPREAD_M
    );
  if (rival) return { reason: 'ambiguous-tees' };
  return { point: best.t.point, distanceM: Math.round(best.d), teeId: best.t.id };
}

// One result per hole number 1..holeCount. Statuses:
//   matched | ambiguous | unmatched | no-hole-way | duplicate-hole-ways
export function matchGreens({ holes, greens, holeCount, tees = [], holeLengths = {} }) {
  // Mis-tagged OSM greens with <3 points have a meaningless centroid — drop
  // them up front so they can never "win" a proximity match.
  const usableGreens = greens.filter((g) => g.points.length >= 3);
  const results = [];
  for (let n = 1; n <= holeCount; n++) {
    const candidates = holes.filter((h) => Number(h.ref) === n && h.points.length >= 2);
    if (candidates.length === 0) {
      results.push({ holeNumber: n, status: 'no-hole-way' });
      continue;
    }
    if (candidates.length > 1) {
      results.push({ holeNumber: n, status: 'duplicate-hole-ways', count: candidates.length });
      continue;
    }
    const way = candidates[0];
    const attempt = (endpoint) => {
      const ranked = usableGreens
        .map((g) => ({ g, d: haversineMeters(endpoint, centroid(g.points)) }))
        .sort((a, b) => a.d - b.d);
      const best = ranked[0];
      if (!best || best.d > MAX_GREEN_DISTANCE_M) return null;
      const second = ranked[1];
      const ambiguous =
        second && second.d <= MAX_GREEN_DISTANCE_M && second.d - best.d < AMBIGUITY_MARGIN_M;
      return {
        green: best.g,
        distance: Math.round(best.d),
        ambiguous,
        second: second && second.d <= MAX_GREEN_DISTANCE_M
          ? { greenId: second.g.id, distanceM: Math.round(second.d) }
          : null
      };
    };
    const endA = attempt(way.points[way.points.length - 1]);
    const endB = attempt(way.points[0]);
    // The green end is the endpoint whose nearest green is closest; the other
    // end is the tee. A reversed (green→tee) way therefore matches correctly.
    let hit = null;
    let reversed = false;
    if (endA && endB) {
      if (endA.distance <= endB.distance) hit = endA;
      else { hit = endB; reversed = true; }
    } else if (endA) {
      hit = endA;
    } else if (endB) {
      hit = endB;
      reversed = true;
    }
    if (!hit) {
      results.push({
        holeNumber: n,
        status: 'unmatched',
        // Where the agent should point snap.mjs --center when tracing.
        lookAt: way.points[way.points.length - 1]
      });
      continue;
    }
    const tee = pickTee({
      tees,
      greenCenter: centroid(hit.green.points),
      holeLengthM: holeLengths[n]
    });
    results.push({
      holeNumber: n,
      status: hit.ambiguous ? 'ambiguous' : 'matched',
      reversedWay: reversed,
      greenId: hit.green.id,
      distanceM: hit.distance,
      polygon: hit.green.points,
      ...(hit.second ? { secondGreenId: hit.second.greenId, secondDistanceM: hit.second.distanceM } : {}),
      ...(tee?.point ? { teePoint: tee.point, teeDistanceM: tee.distanceM, teeId: tee.teeId } : {}),
      ...(tee?.reason ? { teeNote: tee.reason } : {})
    });
  }
  // A green claimed by two holes usually means one hole way is reversed and
  // its tee-end stole a neighbouring green — never import those silently.
  const claims = new Map();
  for (const r of results) if (r.greenId) claims.set(r.greenId, (claims.get(r.greenId) ?? 0) + 1);
  for (const r of results) {
    if (r.greenId && claims.get(r.greenId) > 1 && r.status === 'matched') {
      r.status = 'ambiguous';
      r.reason = 'shared-green';
    }
  }
  return results;
}
