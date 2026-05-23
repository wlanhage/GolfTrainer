// Profile / user
export type DominantHand = 'RIGHT' | 'LEFT' | null;
export type UserRole = 'USER' | 'PREMIUM_USER' | 'ADMIN';

export type ProfileData = {
  displayName: string;
  avatarImage: string | null;
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

export type MyStats = {
  favoriteClub: string | null;
  longestDriveMeters: number | null;
  totalCaddyShots: number;
  missionsCompleted: number;
  totalMissionEntries: number;
  memberSince: string | null;
};

// Training
export type ScoreInputType = 'stepper' | 'manual';
export type ScoreDirection = 'ASC' | 'DESC';
export type LeaderboardFilter = 'all' | 'friends' | 'mine';

export type LeaderboardEntry = {
  id: string;
  userId: string;
  playerName: string;
  score: number;
  submittedAt?: string;
  isFriend?: boolean;
  isCurrentUser?: boolean;
};

export type TrainingMission = {
  id: string;
  title: string;
  symbol: string;
  description: string;
  objective: string;
  scoreLabel: string;
  scoreInputType: ScoreInputType;
  scoreDirection: ScoreDirection;
  defaultScore?: number;
  stepperMin?: number;
  stepperMax?: number;
  maxScore?: number | null;
  endsAt?: string | null;
  leaderboard: LeaderboardEntry[];
};

export type MissionEntryHistoryItem = {
  id: string;
  score: number;
  notes: string | null;
  submittedAt: string;
};

export type MissionHistory = {
  entries: MissionEntryHistoryItem[];
  best: number | null;
  rank: number | null;
};

export type MissionSubmitResult = {
  entry: { id: string; score: number; submittedAt: string; notes: string | null };
  isPB: boolean;
  previousBest: number | null;
  currentBest: number | null;
  rank: number;
};

// Caddy
export type CaddyClub = { id: string; name: string };

export type CaddyShot = {
  id: string;
  clubKey: string;
  distanceMeters: number;
  lateralOffsetMeters: number;
  peakHeightMeters?: number;
  spinRpm?: number;
  recordedAt: string;
};

export type CaddyClubSummary = {
  clubKey: string;
  clubLabel: string;
  sampleCount: number;
  trimmedSampleCount: number;
  trimPercentEachSide: number;
  distanceMeters?: number;
  lateralOffsetMeters?: number;
  dispersionMeters?: number;
  peakHeightMeters?: number;
  spinRpm?: number;
};

export type CaddyShotInput = {
  distanceMeters: string;
  lateralOffsetMeters: string;
  peakHeightMeters: string;
  spinRpm: string;
};

export const emptyShotInput = (): CaddyShotInput => ({
  distanceMeters: '',
  lateralOffsetMeters: '',
  peakHeightMeters: '',
  spinRpm: ''
});

// Admin
export type MissionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type MissionScoreInputType = 'STEPPER' | 'MANUAL_NUMBER';

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

// Play / Course
export type SyncStatus = 'pending' | 'synced' | 'failed';
export type CourseSource = 'manual' | 'imported' | 'user_created';
export type RoundStatus = 'in_progress' | 'completed' | 'abandoned';
export type LayoutMappingStatus = 'not_started' | 'partial' | 'required_complete' | 'full';

export type GeoPoint = { lat: number; lng: number };

export type HoleLayoutLayer = 'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob';

export type HoleLayoutGeometry = {
  teePoint: GeoPoint | null;
  greenPolygon: GeoPoint[];
  fairwayPolygon: GeoPoint[];
  bunkerPolygons: GeoPoint[][];
  treesPolygons: GeoPoint[][];
  obPolygons: GeoPoint[][];
};

export type HoleLayoutDerived = {
  hole_bearing: number | null;
  hole_length_meters: number | null;
  tee_to_green_centerline: GeoPoint[];
};

export type Course = {
  id: string;
  clubName: string;
  courseName: string;
  teeName: string | null;
  holeCount: 9 | 18;
  createdAt: string;
  updatedAt: string;
  source: CourseSource;
  isDraft: boolean;
  localOnly: boolean;
  syncStatus: SyncStatus;
};

export type Hole = {
  id: string;
  courseId: string;
  holeNumber: number;
  par: number | null;
  length: number | null;
  hcpIndex: number | null;
  createdAt: string;
  updatedAt: string;
};

export type HoleLayout = {
  id: string;
  holeId: string;
  geometry: HoleLayoutGeometry;
  layoutStatus: LayoutMappingStatus;
  derived: HoleLayoutDerived;
  createdAt: string;
  updatedAt: string;
};

export type RoundFormatKey =
  | 'STROKE_PLAY'
  | 'STABLEFORD'
  | 'BEST_BALL_TEAM'
  | 'BEST_BALL_2V2'
  | 'FFA_STROKE'
  | 'FFA_STABLEFORD'
  | 'WOLF';

export type WolfRole = 'WOLF' | 'PARTNER' | 'OPPONENT';

export type Round = {
  id: string;
  userId: string;
  courseId: string;
  startedAt: string;
  finishedAt: string | null;
  currentHoleNumber: number;
  status: RoundStatus;
  format: RoundFormatKey;
  teeNameSnapshot: string | null;
  courseNameSnapshot: string;
  clubNameSnapshot: string;
};

export type RoundPlayer = {
  id: string;
  roundId: string;
  userId: string;
  displayNameSnapshot: string;
  team: string | null;
  order: number;
};

export type RoundHoleScore = {
  id: string;
  roundHoleId: string;
  playerId: string;
  strokes: number | null;
  wolfRole: WolfRole | null;
};

export type MutualFollower = {
  userId: string;
  displayName: string;
  avatarImage: string | null;
};

export type AppNotificationType = 'ROUND_STARTED';

export type AppNotification = {
  id: string;
  userId: string;
  type: AppNotificationType;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
};

export type RoundHole = {
  id: string;
  roundId: string;
  holeId: string;
  holeNumber: number;
  strokes: number | null;
  parSnapshot: number | null;
  lengthSnapshot: number | null;
  hcpIndexSnapshot: number | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCourseInput = {
  clubName: string;
  courseName: string;
  holeCount: 9 | 18;
  teeName?: string;
};

export type RoundOverviewItem = {
  holeNumber: number;
  par: number | null;
  length: number | null;
  hcpIndex: number | null;
  strokes: number | null;
  scoreStatus: 'missing' | 'done';
  metadataStatus: 'missing' | 'done';
  layoutStatus: LayoutMappingStatus;
};

export type RoundOverview = {
  round: Round;
  items: RoundOverviewItem[];
  totalScore: number;
  totalPar: number;
  relativeToPar: number | null;
  completedHoles: number;
};

export type ScorecardSetupMode = 'bulk_now' | 'per_hole' | 'skip';

// Follows / public profile
export type PublicUserSummary = {
  id: string;
  displayName: string;
  avatarImage: string | null;
  homeClub: string | null;
  handicap: number | null;
  dominantHand: DominantHand;
};

export type PublicUserProfile = PublicUserSummary & {
  favoriteClub: string | null;
};

export type FollowEntry = {
  userId: string;
  username: string;
  followedAt: string;
};

export type FollowCounts = {
  userId: string;
  followerCount: number;
  followingCount: number;
};

export type FollowingFeedEntry = {
  roundId: string;
  userId: string;
  username: string;
  course: string;
  totalScore: number;
  startedAt: string;
};

export type InProgressRoundSummary = {
  roundId: string;
  courseId: string;
  courseName: string;
  clubName: string;
  currentHoleNumber: number;
  startedAt: string;
};
