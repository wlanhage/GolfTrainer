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

export type AdminDrill = {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  metricType: 'SUCCESS_RATE' | 'DISTANCE_CONTROL' | 'DISPERSION' | 'STROKES' | 'TIME_BASED';
  isPublic: boolean;
};
