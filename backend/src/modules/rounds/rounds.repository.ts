import { prisma } from '../../infrastructure/prisma/client.js';

type CreateRoundData = {
  userId: string;
  courseId: string;
  courseNameSnapshot: string;
  clubNameSnapshot: string;
  teeNameSnapshot: string | null;
  holes: Array<{
    holeId: string;
    holeNumber: number;
    par: number | null;
    length: number | null;
    hcpIndex: number | null;
  }>;
};

export const roundsRepository = {
  async createRound(data: CreateRoundData) {
    return prisma.round.create({
      data: {
        userId: data.userId,
        courseId: data.courseId,
        courseNameSnapshot: data.courseNameSnapshot,
        clubNameSnapshot: data.clubNameSnapshot,
        teeNameSnapshot: data.teeNameSnapshot,
        status: 'IN_PROGRESS',
        currentHoleNumber: 1,
        roundHoles: {
          create: data.holes.map((h) => ({
            holeId: h.holeId,
            holeNumber: h.holeNumber,
            parSnapshot: h.par,
            lengthSnapshot: h.length,
            hcpIndexSnapshot: h.hcpIndex
          }))
        }
      },
      include: { roundHoles: { orderBy: { holeNumber: 'asc' } } }
    });
  },

  listForUser(userId: string, opts: { status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'; limit: number; offset: number }) {
    return prisma.round.findMany({
      where: { userId, ...(opts.status ? { status: opts.status } : {}) },
      orderBy: { startedAt: 'desc' },
      take: opts.limit,
      skip: opts.offset
    });
  },

  getByIdForUser(roundId: string, userId: string) {
    return prisma.round.findFirst({
      where: { id: roundId, userId },
      include: { roundHoles: { orderBy: { holeNumber: 'asc' } } }
    });
  },

  async updateRound(
    roundId: string,
    userId: string,
    patch: {
      currentHoleNumber?: number;
      status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
      finishedAt?: Date | null;
      totalScore?: number | null;
    }
  ) {
    const existing = await prisma.round.findFirst({ where: { id: roundId, userId }, select: { id: true } });
    if (!existing) return null;
    return prisma.round.update({
      where: { id: roundId },
      data: patch,
      include: { roundHoles: { orderBy: { holeNumber: 'asc' } } }
    });
  },

  async updateRoundHole(
    roundId: string,
    userId: string,
    holeNumber: number,
    patch: { strokes?: number | null; notes?: string | null }
  ) {
    // Säkerställ att rundan tillhör användaren
    const round = await prisma.round.findFirst({ where: { id: roundId, userId }, select: { id: true } });
    if (!round) return null;

    const completedAt = patch.strokes === null ? null : patch.strokes !== undefined ? new Date() : undefined;
    return prisma.roundHole.update({
      where: { roundId_holeNumber: { roundId, holeNumber } },
      data: { ...patch, completedAt }
    });
  },

  async computeTotalScore(roundId: string): Promise<number | null> {
    const result = await prisma.roundHole.aggregate({
      where: { roundId, strokes: { not: null } },
      _sum: { strokes: true },
      _count: { _all: true }
    });
    if (result._count._all === 0) return null;
    return result._sum.strokes ?? 0;
  },

  async deleteRound(roundId: string, userId: string) {
    const existing = await prisma.round.findFirst({ where: { id: roundId, userId }, select: { id: true } });
    if (!existing) return false;
    await prisma.round.delete({ where: { id: roundId } });
    return true;
  }
};
