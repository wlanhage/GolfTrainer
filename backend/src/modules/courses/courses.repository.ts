import { HoleLayoutMappingStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/client.js';

type CourseFilters = { search?: string };

type CourseBaseData = {
  clubName: string;
  courseName: string;
  teeName?: string | null;
  holeCount: 9 | 18;
  isDraft?: boolean;
};

const orderBy = [{ updatedAt: 'desc' as const }];

const searchableWhere = (search?: string): Prisma.CourseWhereInput => {
  const query = search?.trim();
  if (!query) return {};

  return {
    OR: [
      { clubName: { contains: query, mode: 'insensitive' } },
      { courseName: { contains: query, mode: 'insensitive' } },
      { teeName: { contains: query, mode: 'insensitive' } }
    ]
  };
};

export const coursesRepository = {
  list(filters: CourseFilters) {
    return prisma.course.findMany({
      where: {
        localOnly: false,
        ...searchableWhere(filters.search)
      },
      orderBy,
      include: {
        holes: {
          orderBy: { holeNumber: 'asc' }
        }
      }
    });
  },

  getById(id: string) {
    return prisma.course.findFirst({
      where: { id, localOnly: false },
      include: {
        holes: {
          orderBy: { holeNumber: 'asc' },
          include: { holeLayout: true }
        }
      }
    });
  },

  create(userId: string, data: CourseBaseData) {
    return prisma.course.create({
      data: {
        userId,
        clubName: data.clubName,
        courseName: data.courseName,
        teeName: data.teeName ?? null,
        holeCount: data.holeCount,
        isDraft: data.isDraft ?? false,
        localOnly: false,
        source: 'MANUAL',
        syncStatus: 'SYNCED'
      }
    });
  },

  update(id: string, data: Partial<CourseBaseData>) {
    return prisma.course.updateMany({
      where: { id },
      data: {
        ...(data.clubName !== undefined ? { clubName: data.clubName } : {}),
        ...(data.courseName !== undefined ? { courseName: data.courseName } : {}),
        ...(data.teeName !== undefined ? { teeName: data.teeName ?? null } : {}),
        ...(data.holeCount !== undefined ? { holeCount: data.holeCount } : {}),
        ...(data.isDraft !== undefined ? { isDraft: data.isDraft } : {})
      }
    });
  },

  delete(id: string) {
    return prisma.course.deleteMany({ where: { id } });
  },

  async ensureHoles(courseId: string, holeCount: 9 | 18) {
    const existing = await prisma.hole.findMany({ where: { courseId }, orderBy: { holeNumber: 'asc' } });
    const existingByNumber = new Set(existing.map((hole) => hole.holeNumber));

    const created = await prisma.$transaction(async (tx) => {
      const holesToCreate = Array.from({ length: holeCount }, (_, idx) => idx + 1)
        .filter((holeNumber) => !existingByNumber.has(holeNumber))
        .map((holeNumber) => ({ courseId, holeNumber }));

      if (holesToCreate.length > 0) {
        await tx.hole.createMany({ data: holesToCreate });
      }

      const holes = await tx.hole.findMany({ where: { courseId }, orderBy: { holeNumber: 'asc' } });
      const holeIds = holes.map((hole) => hole.id);
      const existingLayouts = await tx.holeLayout.findMany({ where: { holeId: { in: holeIds } } });
      const existingLayoutIds = new Set(existingLayouts.map((layout) => layout.holeId));

      const layoutsToCreate = holes
        .filter((hole) => !existingLayoutIds.has(hole.id))
        .map((hole) => ({
          holeId: hole.id,
          mappingStatus: HoleLayoutMappingStatus.NOT_STARTED,
          layoutStatus: HoleLayoutMappingStatus.NOT_STARTED
        }));

      if (layoutsToCreate.length > 0) {
        await tx.holeLayout.createMany({ data: layoutsToCreate });
      }

      return holes;
    });

    return created;
  },

  getHoleByNumber(courseId: string, holeNumber: number) {
    return prisma.hole.findFirst({ where: { courseId, holeNumber } });
  },

  updateHoleMeta(holeId: string, data: { par?: number | null; length?: number | null; hcpIndex?: number | null }) {
    return prisma.hole.updateMany({ where: { id: holeId }, data });
  },

  updateHoleLayout(holeId: string, data: {
    teePoint: any;
    greenPolygon: any;
    fairwayPolygon: any;
    bunkerPolygons: any;
    treesPolygons: any;
    obPolygons: any;
    holeBearing: number | null;
    holeLengthMeters: number | null;
    teeToGreenCenterline: any;
    mappingStatus: HoleLayoutMappingStatus;
  }) {
    return prisma.holeLayout.upsert({
      where: { holeId },
      create: {
        holeId,
        teePoint: data.teePoint,
        greenPolygon: data.greenPolygon,
        fairwayPolygon: data.fairwayPolygon,
        bunkerPolygons: data.bunkerPolygons,
        treesPolygons: data.treesPolygons,
        obPolygons: data.obPolygons,
        holeBearing: data.holeBearing,
        holeLengthMeters: data.holeLengthMeters,
        teeToGreenCenterline: data.teeToGreenCenterline,
        mappingStatus: data.mappingStatus,
        layoutStatus: data.mappingStatus
      },
      update: {
        teePoint: data.teePoint,
        greenPolygon: data.greenPolygon,
        fairwayPolygon: data.fairwayPolygon,
        bunkerPolygons: data.bunkerPolygons,
        treesPolygons: data.treesPolygons,
        obPolygons: data.obPolygons,
        holeBearing: data.holeBearing,
        holeLengthMeters: data.holeLengthMeters,
        teeToGreenCenterline: data.teeToGreenCenterline,
        mappingStatus: data.mappingStatus,
        layoutStatus: data.mappingStatus
      }
    });
  }
};
