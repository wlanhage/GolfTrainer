export type Role = 'BASIC_USER' | 'USER' | 'PREMIUM_USER' | 'ADMIN';

export type Profile = {
  displayName: string;
  city: string | null;
  country: string | null;
  homeClub: string | null;
};

export type User = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  profile: Profile | null;
};

export type Mission = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  objective: string;
  scoreLabel: string;
  scoreInputType: 'STEPPER' | 'MANUAL_NUMBER';
  stepperMin: number | null;
  stepperMax: number | null;
  defaultScore: number | null;
  maxScore: number | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  startsAt: string | null;
  endsAt: string | null;
  leaderboard: {
    id: string;
    title: string | null;
    isActive: boolean;
  } | null;
};

export type ClubDistance = {
  clubId: string;
  name: string;
  carryDistance: number;
  totalDistance: number;
  shotShape: string;
};

export type GeoPoint = { lat: number; lng: number };

export type HoleLayoutGeometry = {
  teePoint: GeoPoint | null;
  greenPolygon: GeoPoint[];
  fairwayPolygon: GeoPoint[];
  bunkerPolygons: GeoPoint[][];
  treesPolygons: GeoPoint[][];
  obPolygons: GeoPoint[][];
};

export type Hole = {
  id: string;
  holeNumber: number;
  par: number | null;
  length: number | null;
  hcpIndex: number | null;
  layout: HoleLayoutGeometry;
};

export type Course = {
  id: string;
  clubName: string;
  courseName: string;
  teeName: string;
  holeCount: 9 | 18;
  holes: Hole[];
};
