export type DominantHand = 'RIGHT' | 'LEFT' | null;
export type UserRole = 'BASIC_USER' | 'USER' | 'PREMIUM_USER' | 'ADMIN';

export type ProfileData = {
  displayName: string;
  homeClub: string | null;
  city: string | null;
  country: string | null;
  dominantHand: DominantHand;
  handicap: number | null;
  targetHandicap: number | null;
  skillLevel: string | null;
  yearsPlaying: number | null;
  roundsLast12Months: number | null;
  trainingDaysPerWeek: number | null;
  favoriteClub: string | null;
  strengthArea: string | null;
  focusArea: string | null;
  goals: string | null;
};

export type MeResponse = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  profile: ProfileData | null;
};

export type UpdateProfileInput = Partial<ProfileData>;
