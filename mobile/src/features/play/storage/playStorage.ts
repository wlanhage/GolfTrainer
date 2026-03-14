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
import { createEmptyLayoutGeometry, resolveLayoutMappingStatus } from '../utils/layout';
import { getRelativeToPar } from '../utils/roundLogic';
import { validateCourseInput, validateHoleMetaValues } from '../utils/validation';

const PLAY_STORAGE_KEY = 'golftrainer.play.v1';

const createEmptyDatabase = (): PlayDatabase => ({
  courses: [],
  holes: [],
  holeLayouts: [],
  rounds: [],
  roundHoles: []
});

const nowIso = () => new Date().toISOString();

async function readDatabase(): Promise<PlayDatabase> {
  const raw = await AsyncStorage.getItem(PLAY_STORAGE_KEY);
  if (!raw) return createEmptyDatabase();

  try {
    return JSON.parse(raw) as PlayDatabase;
  } catch {
    return createEmptyDatabase();
  }
}

async function saveDatabase(database: PlayDatabase) {
  await AsyncStorage.setItem(PLAY_STORAGE_KEY, JSON.stringify(database));
}

export const playStorage = {
  async listCourses(search = '') {
    const db = await readDatabase();
    const query = search.trim().toLowerCase();

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

    course.clubName = nextCourse.clubName.trim();
    course.courseName = nextCourse.courseName.trim();
    course.teeName = nextCourse.teeName?.trim() || null;
    course.holeCount = nextCourse.holeCount;
    course.updatedAt = nowIso();

    await saveDatabase(db);
    return course;
  },

  async getCourseWithHoles(courseId: string) {
    const db = await readDatabase();
    const course = db.courses.find((entry) => entry.id === courseId);
    if (!course) return null;

    const holes = db.holes
      .filter((hole) => hole.courseId === courseId)
      .sort((a, b) => a.holeNumber - b.holeNumber);

    return { course, holes };
  },

  async getCourseAdminDetails(courseId: string) {
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
        createdAt: timestamp,
        updatedAt: timestamp
      };
      db.holeLayouts.push(layout);
      await saveDatabase(db);
    }

    return { course, hole, layout };
  },

  async createHolesForCourse(courseId: string, holeCount: 9 | 18) {
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
  },

  async updateHoleMeta(holeId: string, input: Partial<Pick<Hole, 'par' | 'length' | 'hcpIndex'>>) {
    const validationError = validateHoleMetaValues(input);
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
    const db = await readDatabase();
    const layout = db.holeLayouts.find((entry) => entry.holeId === holeId);
    if (!layout) throw new Error('Layout hittades inte.');

    layout.geometry = geometry;
    layout.mappingStatus = resolveLayoutMappingStatus(geometry);
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
