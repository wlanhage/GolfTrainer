export type SyncStatus = 'pending' | 'synced' | 'failed';
export type CourseSource = 'manual' | 'imported' | 'user_created';
export type RoundStatus = 'in_progress' | 'completed' | 'abandoned';
export type LayoutMappingStatus = 'not_started' | 'partial' | 'required_complete' | 'full';

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type HoleLayoutLayer = 'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob';

export type HoleLayoutGeometry = {
  teePoint: GeoPoint | null;
  greenPolygon: GeoPoint[];
  fairwayPolygon: GeoPoint[];
  bunkerPolygons: GeoPoint[][];
  treesPolygons: GeoPoint[][];
  obPolygons: GeoPoint[][];
};

export type HoleAxis = {
  origin: GeoPoint;
  target: GeoPoint;
  bearing: number;
  lengthMeters: number;
  teeToGreenCenterline: GeoPoint[];
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
  mappingStatus: LayoutMappingStatus;
  layout_status?: LayoutMappingStatus;
  derived: HoleLayoutDerived;
  createdAt: string;
  updatedAt: string;
};

export type Round = {
  id: string;
  courseId: string;
  startedAt: string;
  finishedAt: string | null;
  currentHoleNumber: number;
  status: RoundStatus;
  createdOffline: boolean;
  syncStatus: SyncStatus;
  teeNameSnapshot: string | null;
  courseNameSnapshot: string;
  clubNameSnapshot: string;
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

export type ScorecardSetupMode = 'bulk_now' | 'per_hole' | 'skip';

export type CreateCourseInput = {
  clubName: string;
  courseName: string;
  holeCount: 9 | 18;
  teeName?: string;
};

export type PlayDatabase = {
  courses: Course[];
  holes: Hole[];
  holeLayouts: HoleLayout[];
  rounds: Round[];
  roundHoles: RoundHole[];
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

export type InProgressRoundSummary = {
  roundId: string;
  courseId: string;
  courseName: string;
  clubName: string;
  currentHoleNumber: number;
  startedAt: string;
};
