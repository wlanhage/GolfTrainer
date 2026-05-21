// Pure scoring-funktioner för olika spelformer. Inget UI, inga API-calls —
// så det är trivialt att testa och flytta till backend senare.
//
// Stableford är "scratch" (utan handicap): birdie=3, par=2, bogey=1, etc.

import type { RoundFormatKey } from './playFormats';

export type HoleResult = {
  holeNumber: number;
  par: number | null;
  strokes: number | null;
};

export type PlayerHoleResult = HoleResult & { playerId: string };

// ---------------------------------------------------------------------------
// Stableford
// ---------------------------------------------------------------------------

export function stablefordPoints(strokes: number | null, par: number | null): number | null {
  if (strokes === null || par === null) return null;
  const diff = strokes - par;
  if (diff <= -2) return 4;
  if (diff === -1) return 3;
  if (diff === 0) return 2;
  if (diff === 1) return 1;
  return 0;
}

export function totalStablefordPoints(holes: HoleResult[]): number {
  return holes.reduce((s, h) => s + (stablefordPoints(h.strokes, h.par) ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Best ball — minsta strokes per hål bland lag-medlemmar
// ---------------------------------------------------------------------------

export function bestBallTeamScorePerHole(
  scoresThisHole: { strokes: number | null }[]
): number | null {
  const valid = scoresThisHole.map((s) => s.strokes).filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

export function bestBallTeamTotal(
  perHole: { strokes: number | null }[][]
): number {
  return perHole.reduce((sum, hole) => sum + (bestBallTeamScorePerHole(hole) ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Wolf — per hål
// ---------------------------------------------------------------------------

export type WolfHolePlayer = {
  playerId: string;
  role: 'WOLF' | 'PARTNER' | 'OPPONENT';
  strokes: number | null;
};

export type WolfHolePointsResult = Record<string, number>;

/**
 * Räknar Wolf-poäng för ett enskilt hål.
 * - Wolf+partner: båda får 2 poäng om de vinner, 0 om de förlorar/tie.
 * - Wolf ensam (lone wolf, ingen PARTNER definierad): wolf får 4 poäng vid
 *   vinst, 0 vid förlust. Förlorande motståndare får 1 poäng var vid förlust
 *   mot wolfs lag.
 * - Tie: 0 till alla.
 *
 * "Vinst" = lägsta strokes-värde i laget (best ball-logik per lag).
 */
export function wolfHolePoints(players: WolfHolePlayer[]): WolfHolePointsResult {
  const out: WolfHolePointsResult = {};
  for (const p of players) out[p.playerId] = 0;

  const wolfTeam = players.filter((p) => p.role === 'WOLF' || p.role === 'PARTNER');
  const opponents = players.filter((p) => p.role === 'OPPONENT');
  if (wolfTeam.length === 0 || opponents.length === 0) return out;

  const wolfBest = bestBallTeamScorePerHole(wolfTeam);
  const oppBest = bestBallTeamScorePerHole(opponents);
  if (wolfBest === null || oppBest === null) return out;

  const wolfPlayer = players.find((p) => p.role === 'WOLF');
  const partner = players.find((p) => p.role === 'PARTNER');
  const lone = !partner;

  if (wolfBest < oppBest) {
    // wolf-team vinner
    if (lone) {
      if (wolfPlayer) out[wolfPlayer.playerId] = 4;
    } else {
      if (wolfPlayer) out[wolfPlayer.playerId] = 2;
      if (partner) out[partner.playerId] = 2;
    }
  } else if (oppBest < wolfBest) {
    for (const o of opponents) out[o.playerId] = 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Aggregerat — räkna ihop totalsumma för en spelare över alla hål
// ---------------------------------------------------------------------------

export type RoundTotals = {
  strokes: number;
  points: number | null; // null om format inte använder points
};

export function totalForPlayer(
  format: RoundFormatKey,
  holes: HoleResult[],
  wolfPointsByHole: number[] // bara relevant för WOLF
): RoundTotals {
  const strokes = holes.reduce((s, h) => s + (h.strokes ?? 0), 0);
  if (format === 'STABLEFORD' || format === 'FFA_STABLEFORD') {
    return { strokes, points: totalStablefordPoints(holes) };
  }
  if (format === 'WOLF') {
    return { strokes, points: wolfPointsByHole.reduce((s, v) => s + v, 0) };
  }
  return { strokes, points: null };
}
