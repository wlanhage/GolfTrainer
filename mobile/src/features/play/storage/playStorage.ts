import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Course,
  CreateCourseInput,
  Hole,
  HoleLayout,
  HoleLayoutGeometry,
  InProgressRoundSummary,
  PlayDatabase,
  Round,
  RoundHole,
  RoundOverview,
  ScorecardSetupMode
} from '../types/play';
import { createLocalId } from '../utils/id';
import { resolveHoleAxis } from '../services/holeAxis';
import { createEmptyLayoutGeometry, normalizeLayoutGeometry } from '../services/holeLayoutGeometry';
import { resolveLayoutMappingStatus } from '../services/holeLayoutStatus';
import { getRelativeToPar } from '../utils/roundLogic';
import { validateCourseInput, validateHoleMetaValues } from '../utils/validation';
import { tokenStorage } from '../../../shared/api/tokenStorage';
import { API_BASE_URL } from '../../../shared/api/config';

const PLAY_STORAGE_KEY = 'golftrainer.play.v1';

const createEmptyDatabase = (): PlayDatabase => ({
  courses: [],
  holes: [],
  holeLayouts: [],
  rounds: [],
  roundHoles: []
});


const resolveDerivedFromGeometry = (geometry: HoleLayoutGeometry) => {
  const axis = resolveHoleAxis(geometry);
  if (!axis) {
    return { hole_bearing: null, hole_length_meters: null, tee_to_green_centerline: [] };
  }

  return {
    hole_bearing: axis.bearing,
    hole_length_meters: axis.lengthMeters,
    tee_to_green_centerline: axis.teeToGreenCenterline
  };
};
const nowIso = () => new Date().toISOString();

async function requestBackend<T>(path: string, init?: RequestInit): Promise<T> {
  const tokens = await tokenStorage.load();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined)
  };

  if (tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

const toLocalCourse = (course: any): Course => ({
  id: course.id,
  clubName: course.clubName,
  courseName: course.courseName,
  teeName: course.teeName ?? null,
  holeCount: course.holeCount,
  createdAt: typeof course.createdAt === 'string' ? course.createdAt : new Date(course.createdAt).toISOString(),
  updatedAt: typeof course.updatedAt === 'string' ? course.updatedAt : new Date(course.updatedAt).toISOString(),
  source: (String(course.source ?? 'manual').toLowerCase() as Course['source']),
  isDraft: Boolean(course.isDraft),
  localOnly: Boolean(course.localOnly),
  syncStatus: (String(course.syncStatus ?? 'synced').toLowerCase() as Course['syncStatus'])
});

const syncCourseToLocalDb = async (course: any, includeLayouts = false): Promise<PlayDatabase> => {
  const db = await readDatabase();
  const normalizedCourse = toLocalCourse(course);
  db.courses = db.courses.filter((entry) => entry.id !== normalizedCourse.id);
  db.courses.push(normalizedCourse);

  if (Array.isArray(course.holes)) {
    db.holes = db.holes.filter((entry) => entry.courseId !== normalizedCourse.id);

    const syncedHoles: Hole[] = course.holes.map((hole: any) => ({
      id: hole.id,
      courseId: normalizedCourse.id,
      holeNumber: hole.holeNumber,
      par: hole.par ?? null,
      length: hole.length ?? null,
      hcpIndex: hole.hcpIndex ?? null,
      createdAt: typeof hole.createdAt === 'string' ? hole.createdAt : new Date(hole.createdAt).toISOString(),
      updatedAt: typeof hole.updatedAt === 'string' ? hole.updatedAt : new Date(hole.updatedAt).toISOString()
    }));

    db.holes.push(...syncedHoles);

    if (includeLayouts) {
      db.holeLayouts = db.holeLayouts.filter((entry) => !syncedHoles.some((hole) => hole.id === entry.holeId));
      for (const hole of course.holes) {
        const geometry = normalizeLayoutGeometry(hole.layout?.geometry ?? createEmptyLayoutGeometry());
        db.holeLayouts.push({
          id: hole.layout?.id ?? createLocalId(`layout_${hole.holeNumber}`),
          holeId: hole.id,
          geometry,
          mappingStatus: hole.layout?.mappingStatus ?? resolveLayoutMappingStatus(geometry),
          layout_status: hole.layout?.layout_status ?? resolveLayoutMappingStatus(geometry),
          derived: hole.layout?.derived ?? resolveDerivedFromGeometry(geometry),
          createdAt: hole.layout?.createdAt ?? hole.createdAt ?? nowIso(),
          updatedAt: hole.layout?.updatedAt ?? hole.updatedAt ?? nowIso()
        });
      }
    }
  }

  await saveDatabase(db);
  return db;
};


async function readDatabase(): Promise<PlayDatabase> {
  const raw = await AsyncStorage.getItem(PLAY_STORAGE_KEY);
  if (!raw) return createEmptyDatabase();

  try {
    const parsed = JSON.parse(raw) as PlayDatabase;
    return {
      ...createEmptyDatabase(),
      ...parsed,
      holeLayouts: (parsed.holeLayouts ?? []).map((layout) => {
        const geometry = normalizeLayoutGeometry(layout.geometry);
        return {
          ...layout,
          geometry,
          mappingStatus: resolveLayoutMappingStatus(geometry),
          layout_status: resolveLayoutMappingStatus(geometry),
          derived: layout.derived ?? resolveDerivedFromGeometry(geometry)
        };
      })
    };
  } catch {
    return createEmptyDatabase();
  }
}

async function saveDatabase(database: PlayDatabase) {
  await AsyncStorage.setItem(PLAY_STORAGE_KEY, JSON.stringify(database));
}

export const playStorage = {
  async listCourses(search = '') {
    const query = search.trim().toLowerCase();

    try {
      const suffix = query ? `?search=${encodeURIComponent(query)}` : '';
      const courses = await requestBackend<any[]>(`/courses${suffix}`);
      let db = await readDatabase();
      for (const course of courses) {
        db = await syncCourseToLocalDb(course, false);
      }

      return courses.map(toLocalCourse).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch {
      const db = await readDatabase();
      return db.courses
        .filter((course) => {
          if (!query) return true;
          return (
            course.clubName.toLowerCase().includes(query) ||
            course.courseName.toLowerCase().includes(query) ||
            course.teeName?.toLowerCase().includes(query)
          );
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
  },

  async listInProgressRounds(): Promise<InProgressRoundSummary[]> {
    const db = await readDatabase();

    return db.rounds
      .filter((round) => round.status === 'in_progress')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((round) => ({
        roundId: round.id,
        courseId: round.courseId,
        courseName: round.courseNameSnapshot,
        clubName: round.clubNameSnapshot,
        currentHoleNumber: round.currentHoleNumber,
        startedAt: round.startedAt
      }));
  },

  async createCourse(input: CreateCourseInput) {
    const error = validateCourseInput(input);
    if (error) {
      throw new Error(error);
    }

    try {
      const created = await requestBackend<any>('/courses', {
        method: 'POST',
        body: JSON.stringify({
          clubName: input.clubName.trim(),
          courseName: input.courseName.trim(),
          teeName: input.teeName?.trim() || null,
          holeCount: input.holeCount
        })
      });

      await requestBackend(`/courses/${created.id}/holes`, {
        method: 'POST',
        body: JSON.stringify({ holeCount: input.holeCount })
      });

      await syncCourseToLocalDb(await requestBackend<any>(`/courses/${created.id}`), true);
      return toLocalCourse(created);
    } catch {
      const db = await readDatabase();
      const timestamp = nowIso();
      const course: Course = {
        id: createLocalId('course'),
      clubName: input.clubName.trim(),
      courseName: input.courseName.trim(),
      teeName: input.teeName?.trim() || null,
      holeCount: input.holeCount,
      createdAt: timestamp,
      updatedAt: timestamp,
      source: 'manual',
      isDraft: false,
      localOnly: true,
      syncStatus: 'pending'
    };

      db.courses.push(course);
      await saveDatabase(db);
      return course;
    }
  },

  async updateCourse(courseId: string, input: Partial<CreateCourseInput>) {
    const db = await readDatabase();
    const course = db.courses.find((entry) => entry.id === courseId);
    if (!course) throw new Error('Banan hittades inte.');

    const nextCourse: CreateCourseInput = {
      clubName: input.clubName ?? course.clubName,
      courseName: input.courseName ?? course.courseName,
      teeName: input.teeName ?? course.teeName ?? undefined,
      holeCount: input.holeCount ?? course.holeCount
    };

    const error = validateCourseInput(nextCourse);
    if (error) {
      throw new Error(error);
    }

    try {
      await requestBackend(`/courses/${courseId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          clubName: nextCourse.clubName.trim(),
          courseName: nextCourse.courseName.trim(),
          teeName: nextCourse.teeName?.trim() || null,
          holeCount: nextCourse.holeCount
        })
      });
      const synced = await requestBackend<any>(`/courses/${courseId}`);
      await syncCourseToLocalDb(synced, true);
      return toLocalCourse(synced);
    } catch {
      // fallback to local-only update below
    }

    course.clubName = nextCourse.clubName.trim();
    course.courseName = nextCourse.courseName.trim();
    course.teeName = nextCourse.teeName?.trim() || null;
    course.holeCount = nextCourse.holeCount;
    course.updatedAt = nowIso();

    await saveDatabase(db);
    return course;
  },

  async getCourseWithHoles(courseId: string) {
    try {
      const synced = await requestBackend<any>(`/courses/${courseId}`);
      const db = await syncCourseToLocalDb(synced, true);
      const course = db.courses.find((entry) => entry.id === courseId);
      if (!course) return null;
      const holes = db.holes.filter((hole) => hole.courseId === courseId).sort((a, b) => a.holeNumber - b.holeNumber);
      return { course, holes };
    } catch {
      const db = await readDatabase();
      const course = db.courses.find((entry) => entry.id === courseId);
      if (!course) return null;

      const holes = db.holes
        .filter((hole) => hole.courseId === courseId)
        .sort((a, b) => a.holeNumber - b.holeNumber);

      return { course, holes };
    }
  },

  async getCourseAdminDetails(courseId: string) {
    await this.getCourseWithHoles(courseId);
    const db = await readDatabase();
    const course = db.courses.find((entry) => entry.id === courseId);
    if (!course) return null;

    const holes = db.holes
      .filter((hole) => hole.courseId === courseId)
      .sort((a, b) => a.holeNumber - b.holeNumber)
      .map((hole) => ({
        ...hole,
        layout: db.holeLayouts.find((layout) => layout.holeId === hole.id) ?? null
      }));

    return { course, holes };
  },

  async getHoleWithLayout(courseId: string, holeNumber: number) {
    const db = await readDatabase();
    const course = db.courses.find((entry) => entry.id === courseId);
    if (!course) return null;

    const hole = db.holes.find((entry) => entry.courseId === courseId && entry.holeNumber === holeNumber);
    if (!hole) return null;

    let layout = db.holeLayouts.find((entry) => entry.holeId === hole.id) ?? null;
    if (!layout) {
      const timestamp = nowIso();
      layout = {
        id: createLocalId(`layout_${hole.holeNumber}`),
        holeId: hole.id,
        geometry: createEmptyLayoutGeometry(),
        mappingStatus: 'not_started',
        layout_status: 'not_started',
        derived: resolveDerivedFromGeometry(createEmptyLayoutGeometry()),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      db.holeLayouts.push(layout);
      await saveDatabase(db);
    }

    return { course, hole, layout };
  },

  async createHolesForCourse(courseId: string, holeCount: 9 | 18) {
    try {
      await requestBackend(`/courses/${courseId}/holes`, {
        method: 'POST',
        body: JSON.stringify({ holeCount })
      });
      const synced = await requestBackend<any>(`/courses/${courseId}`);
      const dbSynced = await syncCourseToLocalDb(synced, true);
      return dbSynced.holes.filter((hole) => hole.courseId === courseId).sort((a, b) => a.holeNumber - b.holeNumber);
    } catch {
      const db = await readDatabase();
    const existing = db.holes
      .filter((hole) => hole.courseId === courseId)
      .sort((a, b) => a.holeNumber - b.holeNumber);

    const timestamp = nowIso();
    const existingByNumber = new Set(existing.map((hole) => hole.holeNumber));
    const holesToCreate: Hole[] = [];

    for (let holeNumber = 1; holeNumber <= holeCount; holeNumber += 1) {
      if (existingByNumber.has(holeNumber)) continue;

      holesToCreate.push({
        id: createLocalId(`hole_${holeNumber}`),
        courseId,
        holeNumber,
        par: null,
        length: null,
        hcpIndex: null,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }

    const allCourseHoles = [...existing, ...holesToCreate].sort((a, b) => a.holeNumber - b.holeNumber);
    const existingLayoutHoleIds = new Set(db.holeLayouts.map((layout) => layout.holeId));
    const layoutsToCreate: HoleLayout[] = allCourseHoles
      .filter((hole) => !existingLayoutHoleIds.has(hole.id))
      .map((hole) => ({
        id: createLocalId(`layout_${hole.holeNumber}`),
        holeId: hole.id,
        geometry: createEmptyLayoutGeometry(),
        mappingStatus: 'not_started',
        layout_status: 'not_started',
        derived: resolveDerivedFromGeometry(createEmptyLayoutGeometry()),
        createdAt: timestamp,
        updatedAt: timestamp
      }));

    if (holesToCreate.length === 0 && layoutsToCreate.length === 0) {
      return allCourseHoles;
    }

    db.holes.push(...holesToCreate);
    db.holeLayouts.push(...layoutsToCreate);

    const course = db.courses.find((entry) => entry.id === courseId);
    if (course) {
      course.updatedAt = timestamp;
    }

    await saveDatabase(db);
    return allCourseHoles;
    }
  },

  async updateHoleMeta(holeId: string, input: Partial<Pick<Hole, 'par' | 'length' | 'hcpIndex'>>) {
    const validationError = validateHoleMetaValues(input);
    const existing = await this.getHoleById(holeId);
    if (existing) {
      try {
        await requestBackend(`/courses/${existing.courseId}/holes/${existing.holeNumber}`, {
          method: 'PATCH',
          body: JSON.stringify(input)
        });
      } catch {
        // local fallback below
      }
    }
    if (validationError) {
      throw new Error(validationError);
    }

    const db = await readDatabase();
    const hole = db.holes.find((entry) => entry.id === holeId);
    if (!hole) throw new Error('Hålet hittades inte.');

    hole.par = input.par ?? hole.par;
    hole.length = input.length ?? hole.length;
    hole.hcpIndex = input.hcpIndex ?? hole.hcpIndex;
    hole.updatedAt = nowIso();

    await saveDatabase(db);
    return hole;
  },

  async updateHoleLayout(holeId: string, geometry: HoleLayoutGeometry) {
    const existing = await this.getHoleById(holeId);
    if (existing) {
      try {
        await requestBackend(`/courses/${existing.courseId}/holes/${existing.holeNumber}/layout`, {
          method: 'PATCH',
          body: JSON.stringify({ geometry })
        });
      } catch {
        // local fallback below
      }
    }

    const db = await readDatabase();
    const layout = db.holeLayouts.find((entry) => entry.holeId === holeId);
    if (!layout) throw new Error('Layout hittades inte.');

    const normalizedGeometry = normalizeLayoutGeometry(geometry);
    layout.geometry = normalizedGeometry;
    layout.mappingStatus = resolveLayoutMappingStatus(normalizedGeometry);
    layout.layout_status = layout.mappingStatus;
    layout.derived = resolveDerivedFromGeometry(normalizedGeometry);
    layout.updatedAt = nowIso();

    await saveDatabase(db);
    return layout;
  },

  async createRoundHoles(roundId: string, holes: Hole[]) {
    const db = await readDatabase();
    const existingRoundHoles = db.roundHoles
      .filter((entry) => entry.roundId === roundId)
      .sort((a, b) => a.holeNumber - b.holeNumber);

    if (existingRoundHoles.length > 0) {
      return existingRoundHoles;
    }

    const timestamp = nowIso();
    const createdRoundHoles: RoundHole[] = holes.map((hole) => ({
      id: createLocalId(`round_hole_${hole.holeNumber}`),
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

    db.roundHoles.push(...createdRoundHoles);
    await saveDatabase(db);

    return createdRoundHoles;
  },

  async startRound(courseId: string) {
    const db = await readDatabase();
    const course = db.courses.find((entry) => entry.id === courseId);
    if (!course) throw new Error('Banan hittades inte.');

    const holes = db.holes
      .filter((hole) => hole.courseId === courseId)
      .sort((a, b) => a.holeNumber - b.holeNumber);
    if (holes.length === 0) {
      throw new Error('Banans hål saknas. Skapa hålen först.');
    }

    const timestamp = nowIso();
    const round: Round = {
      id: createLocalId('round'),
      courseId,
      startedAt: timestamp,
      finishedAt: null,
      currentHoleNumber: 1,
      status: 'in_progress',
      createdOffline: true,
      syncStatus: 'pending',
      teeNameSnapshot: course.teeName,
      courseNameSnapshot: course.courseName,
      clubNameSnapshot: course.clubName
    };

    db.rounds.push(round);
    await saveDatabase(db);

    await this.createRoundHoles(round.id, holes);
    return round;
  },

  async getRound(roundId: string) {
    const db = await readDatabase();
    const round = db.rounds.find((entry) => entry.id === roundId);
    if (!round) return null;

    const roundHoles = db.roundHoles
      .filter((entry) => entry.roundId === roundId)
      .sort((a, b) => a.holeNumber - b.holeNumber);

    return { round, roundHoles };
  },

  async getRoundHole(roundId: string, holeNumber: number) {
    const db = await readDatabase();
    const round = db.rounds.find((entry) => entry.id === roundId);
    if (!round) return null;

    const roundHole = db.roundHoles.find((entry) => entry.roundId === roundId && entry.holeNumber === holeNumber);
    if (!roundHole) return null;

    const hole = db.holes.find((entry) => entry.id === roundHole.holeId) ?? null;
    const layout = db.holeLayouts.find((entry) => entry.holeId === roundHole.holeId) ?? null;

    return { round, roundHole, hole, layout };
  },

  async saveRoundHoleScore(roundId: string, holeNumber: number, strokes: number | null, notes?: string) {
    const db = await readDatabase();
    const roundHole = db.roundHoles.find((entry) => entry.roundId === roundId && entry.holeNumber === holeNumber);
    if (!roundHole) throw new Error('Rundhål hittades inte.');

    const sourceHole = db.holes.find((entry) => entry.id === roundHole.holeId);

    roundHole.strokes = strokes;
    roundHole.notes = notes?.trim() || null;
    roundHole.completedAt = strokes === null ? null : nowIso();
    roundHole.parSnapshot = sourceHole?.par ?? roundHole.parSnapshot;
    roundHole.lengthSnapshot = sourceHole?.length ?? roundHole.lengthSnapshot;
    roundHole.hcpIndexSnapshot = sourceHole?.hcpIndex ?? roundHole.hcpIndexSnapshot;
    roundHole.updatedAt = nowIso();

    await saveDatabase(db);
    return roundHole;
  },

  async goToNextHole(roundId: string) {
    const db = await readDatabase();
    const round = db.rounds.find((entry) => entry.id === roundId);
    if (!round) throw new Error('Rundan hittades inte.');

    const totalHoles = db.roundHoles.filter((entry) => entry.roundId === roundId).length;
    round.currentHoleNumber = Math.min(round.currentHoleNumber + 1, totalHoles);
    await saveDatabase(db);
    return round;
  },

  async setCurrentHole(roundId: string, holeNumber: number) {
    const db = await readDatabase();
    const round = db.rounds.find((entry) => entry.id === roundId);
    if (!round) throw new Error('Rundan hittades inte.');

    round.currentHoleNumber = holeNumber;
    await saveDatabase(db);
    return round;
  },

  async completeRound(roundId: string) {
    const db = await readDatabase();
    const round = db.rounds.find((entry) => entry.id === roundId);
    if (!round) throw new Error('Rundan hittades inte.');

    round.status = 'completed';
    round.finishedAt = nowIso();
    round.syncStatus = 'pending';
    await saveDatabase(db);
    return round;
  },

  async getRoundOverview(roundId: string): Promise<RoundOverview> {
    const db = await readDatabase();
    const round = db.rounds.find((entry) => entry.id === roundId);
    if (!round) throw new Error('Rundan hittades inte.');

    const roundHoles = db.roundHoles
      .filter((entry) => entry.roundId === roundId)
      .sort((a, b) => a.holeNumber - b.holeNumber);

    const items = roundHoles.map((roundHole) => {
      const layout = db.holeLayouts.find((entry) => entry.holeId === roundHole.holeId);
      const scoreStatus: 'missing' | 'done' = roundHole.strokes === null ? 'missing' : 'done';
      const metadataStatus: 'missing' | 'done' =
        roundHole.parSnapshot === null || roundHole.lengthSnapshot === null || roundHole.hcpIndexSnapshot === null
          ? 'missing'
          : 'done';

      return {
        holeNumber: roundHole.holeNumber,
        par: roundHole.parSnapshot,
        length: roundHole.lengthSnapshot,
        hcpIndex: roundHole.hcpIndexSnapshot,
        strokes: roundHole.strokes,
        scoreStatus,
        metadataStatus,
        layoutStatus: layout?.mappingStatus ?? 'not_started'
      };
    });

    const totalScore = roundHoles.reduce((sum, entry) => sum + (entry.strokes ?? 0), 0);
    const totalPar = roundHoles.reduce((sum, entry) => sum + (entry.parSnapshot ?? 0), 0);
    const relativeToPar = getRelativeToPar(roundHoles);

    return {
      round,
      items,
      totalScore,
      totalPar,
      relativeToPar,
      completedHoles: roundHoles.filter((entry) => entry.strokes !== null).length
    };
  },

  async ensureSeedData() {
    const db = await readDatabase();
    if (db.courses.length > 0) {
      return;
    }

    const course = await this.createCourse({
      clubName: 'Stockholm Golfklubb',
      courseName: 'Parkbanan',
      holeCount: 9,
      teeName: 'Gul tee'
    });

    const holes = await this.createHolesForCourse(course.id, course.holeCount);
    for (const hole of holes) {
      await this.updateHoleMeta(hole.id, {
        par: hole.holeNumber % 3 === 0 ? 5 : 4,
        length: 280 + hole.holeNumber * 20,
        hcpIndex: hole.holeNumber
      });
    }
  },

  async getHoleById(holeId: string) {
    const db = await readDatabase();
    return db.holes.find((entry) => entry.id === holeId) ?? null;
  },

  async clearAll() {
    await AsyncStorage.removeItem(PLAY_STORAGE_KEY);
  }
};

export const getScorecardSetupModeLabel = (mode: ScorecardSetupMode) => {
  switch (mode) {
    case 'bulk_now':
      return 'Lägg till scorekort nu';
    case 'per_hole':
      return 'Lägg till vid varje tee';
    default:
      return 'Hoppa över tills vidare';
  }
};
