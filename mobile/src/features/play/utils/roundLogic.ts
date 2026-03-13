import { Hole, RoundHole } from '../types/play';

export const createRoundHoleSnapshots = (roundId: string, holes: Hole[], timestamp: string): RoundHole[] =>
  holes.map((hole) => ({
    id: `${roundId}_hole_${hole.holeNumber}`,
    roundId,
    holeId: hole.id,
    holeNumber: hole.holeNumber,
    strokes: null,
    parSnapshot: hole.par,
    lengthSnapshot: hole.length,
    hcpIndexSnapshot: hole.hcpIndex,
    notes: null,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  }));

export const getRelativeToPar = (roundHoles: RoundHole[]): number | null => {
  const totalPar = roundHoles.reduce((sum, hole) => sum + (hole.parSnapshot ?? 0), 0);
  if (totalPar === 0) return null;
  const totalScore = roundHoles.reduce((sum, hole) => sum + (hole.strokes ?? 0), 0);
  return totalScore - totalPar;
};
