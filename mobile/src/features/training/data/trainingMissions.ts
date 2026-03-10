import { TrainingMission } from '../types/training';

/**
 * Missionerna är datadrivna och kan ersättas med entiteter från backend/DB.
 * Så länge ett objekt följer `TrainingMission` renderas listan och detaljvyn automatiskt.
 */
export const trainingMissions: TrainingMission[] = [
  {
    id: 'putting-precision',
    title: 'Putting Precision',
    symbol: '🎯',
    description:
      'Träna precision från korta avstånd. Slå 20 puttar från markerad zon och notera hur många som går i.',
    objective: 'Registrera antal lyckade puttar.',
    scoreLabel: 'Lyckade puttar',
    scoreInputType: 'stepper',
    defaultScore: 0,
    leaderboard: [
      { id: '1', playerName: 'Anna', score: 18, isFriend: true },
      { id: '2', playerName: 'Johan', score: 16 },
      { id: '3', playerName: 'Du', score: 15, isCurrentUser: true },
      { id: '4', playerName: 'Lina', score: 14, isFriend: true }
    ]
  },
  {
    id: 'driving-distance',
    title: 'Driving Distance',
    symbol: '🏌️',
    description:
      'Mät längsta drive under 10 försök. Fokusera på teknik och träff i sweet spot för stabil längd.',
    objective: 'Ange längsta slag i meter.',
    scoreLabel: 'Meter',
    scoreInputType: 'manual',
    defaultScore: 180,
    leaderboard: [
      { id: '1', playerName: 'Markus', score: 264 },
      { id: '2', playerName: 'Ella', score: 257, isFriend: true },
      { id: '3', playerName: 'Du', score: 241, isCurrentUser: true },
      { id: '4', playerName: 'Samir', score: 233, isFriend: true }
    ]
  },
  {
    id: 'chip-challenge',
    title: 'Chip Challenge',
    symbol: '⛳',
    description:
      'Placera bollen inom 1 meter från hål från 10 olika lägen runt green. Poäng för varje lyckad chip.',
    objective: 'Räkna antal chip inom målzon.',
    scoreLabel: 'Träffar',
    scoreInputType: 'stepper',
    defaultScore: 0,
    leaderboard: [
      { id: '1', playerName: 'Klara', score: 9, isFriend: true },
      { id: '2', playerName: 'Du', score: 8, isCurrentUser: true },
      { id: '3', playerName: 'Nils', score: 8 },
      { id: '4', playerName: 'Mia', score: 7, isFriend: true }
    ]
  }
];

export function getTrainingMissionById(missionId: string): TrainingMission | undefined {
  return trainingMissions.find((mission) => mission.id === missionId);
}
