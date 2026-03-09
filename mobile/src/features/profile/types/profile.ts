export type MeResponse = {
  id: string;
  email: string;
  profile: {
    displayName: string;
    dominantHand: 'RIGHT' | 'LEFT' | null;
    handicap: number | null;
    goals: string | null;
  } | null;
};
