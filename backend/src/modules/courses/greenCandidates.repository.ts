import { GreenCandidateStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/client.js';
import { buildLayoutWrite, type HoleLayoutGeometry } from './courses.service.js';

type GeoPoint = { lat: number; lng: number };
type Geometry = {
  teePoint: GeoPoint | null;
  greenPolygon: GeoPoint[];
  fairwayPolygons?: GeoPoint[][];
  fairwayPolygon?: GeoPoint[];
  bunkerPolygons: GeoPoint[][];
  treesPolygons: GeoPoint[][];
  obPolygons: GeoPoint[][];
};

export const greenCandidatesRepository = {
  listOpenForCourse(courseId: string) {
    return prisma.greenCandidate.findMany({
      where: { courseId, status: GreenCandidateStatus.OPEN },
      orderBy: { createdAt: 'asc' }
    });
  },

  createMany(courseId: string, items: Array<{ polygon: GeoPoint[]; forHoles: number[]; source: string }>) {
    return prisma.greenCandidate.createMany({
      data: items.map((i) => ({ courseId, polygon: i.polygon as unknown as Prisma.JsonArray, forHoles: i.forHoles, source: i.source }))
    });
  },

  // Atomic confirm: claim the candidate, guard the hole, write the green — all in one tx.
  // Preserves every other geometry field and only sets greenPolygon (merge-safe).
  // Returns { holeId } on success. Throws { code } on conflict (caught by the service).
  async confirmGreen(params: {
    courseId: string;
    holeNumber: number;
    candidateId: string;
    userId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // Serialize concurrent confirms for the same hole: the loser waits here,
      // then sees the green already written and 409s (below) instead of
      // wrongly assigning a second candidate.
      await tx.$executeRaw`SELECT id FROM "Hole" WHERE "courseId" = ${params.courseId} AND "holeNumber" = ${params.holeNumber} FOR UPDATE`;

      const hole = await tx.hole.findFirst({
        where: { courseId: params.courseId, holeNumber: params.holeNumber },
        include: { holeLayout: true }
      });
      if (!hole) throw { code: 'hole-not-found' as const };

      const candidate = await tx.greenCandidate.findUnique({ where: { id: params.candidateId } });
      if (!candidate || candidate.courseId !== params.courseId) throw { code: 'candidate-not-found' as const };
      if (candidate.status !== GreenCandidateStatus.OPEN) throw { code: 'candidate-taken' as const };
      if (!candidate.forHoles.includes(params.holeNumber)) throw { code: 'not-a-candidate' as const };

      const existingGreen = (hole.holeLayout?.greenPolygon as GeoPoint[] | null) ?? [];
      if (existingGreen.length >= 3) throw { code: 'already-assigned' as const };

      // Atomic claim — if another confirm won the race, count is 0.
      const claim = await tx.greenCandidate.updateMany({
        where: { id: params.candidateId, status: GreenCandidateStatus.OPEN },
        data: { status: GreenCandidateStatus.ASSIGNED, assignedHoleNumber: params.holeNumber, confirmedByUserId: params.userId }
      });
      if (claim.count === 0) throw { code: 'candidate-taken' as const };

      const existing: Geometry = {
        teePoint: (hole.holeLayout?.teePoint as GeoPoint | null) ?? null,
        greenPolygon: [],
        fairwayPolygons: (hole.holeLayout?.fairwayPolygon as GeoPoint[][] | null) ?? [],
        bunkerPolygons: (hole.holeLayout?.bunkerPolygons as GeoPoint[][] | null) ?? [],
        treesPolygons: (hole.holeLayout?.treesPolygons as GeoPoint[][] | null) ?? [],
        obPolygons: (hole.holeLayout?.obPolygons as GeoPoint[][] | null) ?? []
      };
      const geometry = { ...existing, greenPolygon: candidate.polygon as unknown as GeoPoint[] };
      const write = buildLayoutWrite(geometry as HoleLayoutGeometry);
      // buildLayoutWrite types teePoint as GeoPoint | null, but Prisma's generated
      // input types for a nullable Json field want NullableJsonNullValueInput |
      // InputJsonValue | undefined — a plain `null` doesn't structurally satisfy that.
      // courses.repository.ts's updateHoleLayout sidesteps this the same way (typing
      // its `data` param as `any`); we cast at the upsert boundary instead so `write`
      // itself stays typed.
      await tx.holeLayout.upsert({
        where: { holeId: hole.id },
        create: { holeId: hole.id, ...write } as Prisma.HoleLayoutUncheckedCreateInput,
        update: write as Prisma.HoleLayoutUncheckedUpdateInput
      });
      return { holeId: hole.id };
    });
  }
};
