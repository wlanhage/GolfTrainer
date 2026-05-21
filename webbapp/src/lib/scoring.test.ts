import { describe, expect, it } from 'vitest';
import {
  bestBallTeamScorePerHole,
  bestBallTeamTotal,
  stablefordPoints,
  totalForPlayer,
  totalStablefordPoints,
  wolfHolePoints
} from './scoring';

describe('stablefordPoints', () => {
  it('eagle or better → 4', () => {
    expect(stablefordPoints(2, 4)).toBe(4);
    expect(stablefordPoints(1, 4)).toBe(4);
  });
  it('birdie → 3', () => {
    expect(stablefordPoints(3, 4)).toBe(3);
  });
  it('par → 2', () => {
    expect(stablefordPoints(4, 4)).toBe(2);
  });
  it('bogey → 1', () => {
    expect(stablefordPoints(5, 4)).toBe(1);
  });
  it('double bogey or worse → 0', () => {
    expect(stablefordPoints(6, 4)).toBe(0);
    expect(stablefordPoints(8, 4)).toBe(0);
  });
  it('returns null when input missing', () => {
    expect(stablefordPoints(null, 4)).toBeNull();
    expect(stablefordPoints(4, null)).toBeNull();
  });
});

describe('totalStablefordPoints', () => {
  it('sums points over multiple holes', () => {
    const holes = [
      { holeNumber: 1, par: 4, strokes: 3 }, // birdie 3
      { holeNumber: 2, par: 3, strokes: 3 }, // par 2
      { holeNumber: 3, par: 5, strokes: 7 } // double bogey 0
    ];
    expect(totalStablefordPoints(holes)).toBe(5);
  });
  it('treats missing strokes as 0 points', () => {
    expect(totalStablefordPoints([{ holeNumber: 1, par: 4, strokes: null }])).toBe(0);
  });
});

describe('bestBallTeamScorePerHole', () => {
  it('picks the lowest valid stroke count', () => {
    expect(bestBallTeamScorePerHole([{ strokes: 5 }, { strokes: 4 }, { strokes: 6 }])).toBe(4);
  });
  it('ignores nulls', () => {
    expect(bestBallTeamScorePerHole([{ strokes: null }, { strokes: 5 }])).toBe(5);
  });
  it('returns null when all are null', () => {
    expect(bestBallTeamScorePerHole([{ strokes: null }, { strokes: null }])).toBeNull();
  });
});

describe('bestBallTeamTotal', () => {
  it('sums per-hole minima', () => {
    const perHole = [
      [{ strokes: 4 }, { strokes: 5 }],
      [{ strokes: 6 }, { strokes: 3 }]
    ];
    expect(bestBallTeamTotal(perHole)).toBe(7); // 4 + 3
  });
});

describe('wolfHolePoints', () => {
  it('wolf+partner win → 2 pts each, opponents 0', () => {
    const result = wolfHolePoints([
      { playerId: 'a', role: 'WOLF', strokes: 4 },
      { playerId: 'b', role: 'PARTNER', strokes: 5 },
      { playerId: 'c', role: 'OPPONENT', strokes: 6 },
      { playerId: 'd', role: 'OPPONENT', strokes: 5 }
    ]);
    expect(result).toEqual({ a: 2, b: 2, c: 0, d: 0 });
  });
  it('wolf+partner lose → opponents get 1 each', () => {
    const result = wolfHolePoints([
      { playerId: 'a', role: 'WOLF', strokes: 5 },
      { playerId: 'b', role: 'PARTNER', strokes: 6 },
      { playerId: 'c', role: 'OPPONENT', strokes: 4 },
      { playerId: 'd', role: 'OPPONENT', strokes: 5 }
    ]);
    expect(result).toEqual({ a: 0, b: 0, c: 1, d: 1 });
  });
  it('lone wolf win → wolf gets 4', () => {
    const result = wolfHolePoints([
      { playerId: 'a', role: 'WOLF', strokes: 3 },
      { playerId: 'c', role: 'OPPONENT', strokes: 5 },
      { playerId: 'd', role: 'OPPONENT', strokes: 5 }
    ]);
    expect(result).toEqual({ a: 4, c: 0, d: 0 });
  });
  it('lone wolf lose → opponents get 1 each', () => {
    const result = wolfHolePoints([
      { playerId: 'a', role: 'WOLF', strokes: 6 },
      { playerId: 'c', role: 'OPPONENT', strokes: 4 },
      { playerId: 'd', role: 'OPPONENT', strokes: 5 }
    ]);
    expect(result).toEqual({ a: 0, c: 1, d: 1 });
  });
  it('tie → all 0', () => {
    const result = wolfHolePoints([
      { playerId: 'a', role: 'WOLF', strokes: 4 },
      { playerId: 'b', role: 'PARTNER', strokes: 5 },
      { playerId: 'c', role: 'OPPONENT', strokes: 4 },
      { playerId: 'd', role: 'OPPONENT', strokes: 5 }
    ]);
    expect(result).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });
});

describe('totalForPlayer', () => {
  const holes = [
    { holeNumber: 1, par: 4, strokes: 4 },
    { holeNumber: 2, par: 3, strokes: 2 }
  ];
  it('STROKE_PLAY returns strokes only', () => {
    expect(totalForPlayer('STROKE_PLAY', holes, [])).toEqual({ strokes: 6, points: null });
  });
  it('STABLEFORD returns strokes + points', () => {
    // hole 1: par 4 = 2 pts, hole 2: birdie = 3 pts → 5 total
    expect(totalForPlayer('STABLEFORD', holes, [])).toEqual({ strokes: 6, points: 5 });
  });
  it('WOLF totals points from wolf array', () => {
    expect(totalForPlayer('WOLF', holes, [2, 4])).toEqual({ strokes: 6, points: 6 });
  });
});
