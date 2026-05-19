// Smart klubbval för shot-predictor heatmap.
//
// Regler (efter användarval):
// - "Når green" = klubbans snittlängd ≥ avstånd från GPS till green-mittens center.
// - Bland klubbor som når: välj den som har högst andel slag som landar inom
//   green-polygonen, projicerat från GPS-position i hålets bearing.
// - Om ingen klubba når: välj driver om data finns, annars argmax(distance − dispersion).
// - Om ingen klubba har data alls: returnera null (UI ska gömma toggeln).

import type { CaddyClubSummary, CaddyShot, GeoPoint, HoleLayoutGeometry } from './types';
import { fromHoleLocalCoordinates, getGeoDistanceMeters, getPolygonCenter, resolveHoleAxis } from './holeGeometry';

const pointInPolygon = (point: GeoPoint, polygon: GeoPoint[]): boolean => {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const greenHitRatio = (
  shots: CaddyShot[],
  origin: GeoPoint,
  bearing: number,
  green: GeoPoint[]
): number => {
  if (shots.length === 0 || green.length < 3) return 0;
  let hits = 0;
  for (const shot of shots) {
    const landing = fromHoleLocalCoordinates(origin, bearing, shot.distanceMeters, shot.lateralOffsetMeters);
    if (pointInPolygon(landing, green)) hits += 1;
  }
  return hits / shots.length;
};

export type ClubRecommendation = {
  clubKey: string;
  reason: 'reaches_best_green_hit' | 'driver_fallback' | 'longest_safe';
  hitRatio?: number;
};

export type RecommenderInputs = {
  summaries: CaddyClubSummary[];
  shotsByClub: Map<string, CaddyShot[]>;
  geometry: HoleLayoutGeometry | null;
  playerPosition: GeoPoint | null;
};

export function recommendClub(inputs: RecommenderInputs): ClubRecommendation | null {
  const clubsWithData = inputs.summaries.filter((s) => s.sampleCount > 0 && s.distanceMeters !== undefined);
  if (clubsWithData.length === 0) return null;

  const greenCenter = inputs.geometry ? getPolygonCenter(inputs.geometry.greenPolygon) : null;

  // Utan position eller green-center kan vi inte räkna distans → bara fallback-rangordna.
  if (!inputs.playerPosition || !greenCenter || !inputs.geometry) {
    return fallbackPick(clubsWithData);
  }

  const distanceToGreenCenter = getGeoDistanceMeters(inputs.playerPosition, greenCenter);
  const reaching = clubsWithData.filter((c) => (c.distanceMeters ?? 0) >= distanceToGreenCenter);

  if (reaching.length === 0) {
    return fallbackPick(clubsWithData);
  }

  // För att kunna räkna green-hit behöver vi en bearing. Om tee saknas eller axeln
  // inte kan resolvas använder vi bearing från spelare → green-center som approximation.
  const axis = resolveHoleAxis(inputs.geometry);
  const bearing = axis?.bearing ?? bearingTo(inputs.playerPosition, greenCenter);

  let best: { club: CaddyClubSummary; ratio: number } | null = null;
  for (const club of reaching) {
    const shots = inputs.shotsByClub.get(club.clubKey) ?? [];
    const ratio = greenHitRatio(shots, inputs.playerPosition, bearing, inputs.geometry.greenPolygon);
    if (!best || ratio > best.ratio) {
      best = { club, ratio };
    }
  }

  if (!best) return fallbackPick(clubsWithData);

  // Om ingen av de nående klubborna ger green-träffar alls (t.ex. noll spridning utanför green),
  // välj den med snittlängd närmast green-centrum av de som når.
  if (best.ratio === 0) {
    const closest = [...reaching].sort(
      (a, b) => Math.abs((a.distanceMeters ?? 0) - distanceToGreenCenter) - Math.abs((b.distanceMeters ?? 0) - distanceToGreenCenter)
    )[0];
    return { clubKey: closest.clubKey, reason: 'reaches_best_green_hit', hitRatio: 0 };
  }

  return { clubKey: best.club.clubKey, reason: 'reaches_best_green_hit', hitRatio: best.ratio };
}

const fallbackPick = (clubs: CaddyClubSummary[]): ClubRecommendation => {
  const driver = clubs.find((c) => c.clubKey === 'driver');
  if (driver) return { clubKey: driver.clubKey, reason: 'driver_fallback' };

  // Score = längd − spridning. Saknad spridning → räkna som 0 (gynnar klubban).
  let best: { club: CaddyClubSummary; score: number } | null = null;
  for (const club of clubs) {
    const score = (club.distanceMeters ?? 0) - (club.dispersionMeters ?? 0);
    if (!best || score > best.score) best = { club, score };
  }
  return { clubKey: (best?.club.clubKey ?? clubs[0].clubKey), reason: 'longest_safe' };
};

const toRad = (v: number) => (v * Math.PI) / 180;
const toDeg = (v: number) => (v * 180) / Math.PI;

const bearingTo = (from: GeoPoint, to: GeoPoint) => {
  const fLat = toRad(from.lat);
  const tLat = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(tLat);
  const x = Math.cos(fLat) * Math.sin(tLat) - Math.sin(fLat) * Math.cos(tLat) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};
