import { UserRole } from '../../profile/types/profile';

export type AdminUser = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  profile: {
    displayName: string;
    city: string | null;
    country: string | null;
    homeClub: string | null;
  } | null;
};

export type MissionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type MissionScoreInputType = 'STEPPER' | 'MANUAL_NUMBER';

export type AdminMission = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  objective: string;
  scoreLabel: string;
  scoreInputType: MissionScoreInputType;
  stepperMin: number | null;
  stepperMax: number | null;
  defaultScore: number | null;
  maxScore: number | null;
  status: MissionStatus;
  startsAt: string | null;
  endsAt: string | null;
  leaderboard: {
    id: string;
    title: string | null;
    isActive: boolean;
  } | null;
};
