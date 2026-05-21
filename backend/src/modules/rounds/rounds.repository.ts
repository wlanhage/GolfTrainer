import { prisma } from '../../infrastructure/prisma/client.js';
import type { Prisma, RoundFormat } from '@prisma/client';

type CreateRoundPlayerData = {
  userId: string;
  displayNameSnapshot: string;
  team: string | null;
  order: number;
};

type CreateRoundData = {
  hostUserId: string;
  courseId: string;
  courseNameSnapshot: string;
  clubNameSnapshot: string;
  teeNameSnapshot: string | null;
  format: RoundFormat;
  holes: Array<{
    holeId: string;
    holeNumber: number;
    par: number | null;
    length: number | null;
    hcpIndex: number | null;
  }>;
  players: CreateRoundPlayerData[];
};

const ROUND_INCLUDE = {
  roundHoles: {
    orderBy: { holeNumber: 'asc' as const },
    include: { scores: true }
  },
  players: { orderBy: { order: 'asc' as const } }
} satisfies Prisma.RoundInclude;

export const roundsRepository = {
  async createRound(data: CreateRoundData) {
    return prisma.round.create({
      data: {
        userId: data.hostUserId,
        courseId: data.courseId,
        courseNameSnapshot: data.courseNameSnapshot,
        clubNameSnapshot: data.clubNameSnapshot,
        teeNameSnapshot: data.teeNameSnapshot,
        status: 'IN_PROGRESS',
        currentHoleNumber: 1,
        format: data.format,
        roundHoles: {
          create: data.holes.map((h) => ({
            holeId: h.holeId,
            holeNumber: h.holeNumber,
            parSnapshot: h.par,
            lengthSnapshot: h.length,
            hcpIndexSnapshot: h.hcpIndex
          }))
        },
        players: {
          create: data.players.map((p) => ({
            userId: p.userId,
            displayNameSnapshot: p.displayNameSnapshot,
            team: p.team,
            order: p.order
          }))
        }
      },
      include: ROUND_INCLUDE
    });
  },

  /**
   * Returnerar rundor där användaren är host eller listad i players[].
   * Görs i två steg för att hålla queryn enkel.
   */
  async listForUser(
    userId: string,
    opts: { status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'; limit: number; offset: number }
  ) {
    return prisma.round.findMany({
      where: {
        OR: [{ userId }, { players: { some: { userId } } }],
        ...(opts.status ? { status: opts.status } : {})
      },
      orderBy: { startedAt: 'desc' },
      take: opts.limit,
      skip: opts.offset
    });
  },

  /**
   * Hämtar full runda om användaren är host eller listad i players[].
   * Returnerar null om användaren inte har access.
   */
  getByIdForParticipant(roundId: string, userId: string) {
    return prisma.round.findFirst({
      where: {
        id: roundId,
        OR: [{ userId }, { players: { some: { userId } } }]
      },
      include: ROUND_INCLUDE
    });
  },

  /**
   * Returnerar true om användaren har access till rundan (host eller player).
   */
  async hasAccess(roundId: string, userId: string): Promise<boolean> {
    const r = await prisma.round.findFirst({
      where: { id: roundId, OR: [{ userId }, { players: { some: { userId } } }] },
      select: { id: true }
    });
    return r !== null;
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
    const allowed = await this.hasAccess(roundId, userId);
    if (!allowed) return null;
    return prisma.round.update({
      where: { id: roundId },
      data: patch,
      include: ROUND_INCLUDE
    });
  },

  async updateRoundHole(
    roundId: string,
    userId: string,
    holeNumber: number,
    patch: { strokes?: number | null; notes?: string | null }
  ) {
    const allowed = await this.hasAccess(roundId, userId);
    if (!allowed) return null;
    const completedAt = patch.strokes === null ? null : patch.strokes !== undefined ? new Date() : undefined;
    return prisma.roundHole.update({
      where: { roundId_holeNumber: { roundId, holeNumber } },
      data: { ...patch, completedAt }
    });
  },

  /**
   * Upserter score för en specifik spelare på ett specifikt hål.
   * Anropas av alla deltagare i rundan.
   */
  async upsertPlayerScore(
    roundId: string,
    userId: string,
    holeNumber: number,
    playerId: string,
    patch: { strokes?: number | null; wolfRole?: 'WOLF' | 'PARTNER' | 'OPPONENT' | null }
  ) {
    const allowed = await this.hasAccess(roundId, userId);
    if (!allowed) return null;

    const roundHole = await prisma.roundHole.findFirst({
      where: { roundId, holeNumber },
      select: { id: true }
    });
    if (!roundHole) return null;

    const player = await prisma.roundPlayer.findFirst({
      where: { id: playerId, roundId },
      select: { id: true }
    });
    if (!player) return null;

    return prisma.roundHoleScore.upsert({
      where: { roundHoleId_playerId: { roundHoleId: roundHole.id, playerId } },
      update: patch,
      create: {
        roundHoleId: roundHole.id,
        playerId,
        strokes: patch.strokes ?? null,
        wolfRole: patch.wolfRole ?? null
      }
    });
  },

  async computeTotalScore(roundId: string): Promise<number | null> {
    // För solo-rundor (eller alla nyare rundor med players[]) räknar vi från
    // host-spelarens RoundHoleScore. Faller tillbaka till legacy RoundHole.strokes
    // om inga scores finns på player-nivå (gamla data innan multiplayer).
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { userId: true }
    });
    if (!round) return null;

    const hostPlayer = await prisma.roundPlayer.findFirst({
      where: { roundId, userId: round.userId },
      select: { id: true }
    });

    if (hostPlayer) {
      const result = await prisma.roundHoleScore.aggregate({
        where: { playerId: hostPlayer.id, strokes: { not: null } },
        _sum: { strokes: true },
        _count: { _all: true }
      });
      if (result._count._all === 0) return null;
      return result._sum.strokes ?? 0;
    }

    // Legacy fallback
    const legacy = await prisma.roundHole.aggregate({
      where: { roundId, strokes: { not: null } },
      _sum: { strokes: true },
      _count: { _all: true }
    });
    if (legacy._count._all === 0) return null;
    return legacy._sum.strokes ?? 0;
  },

  async deleteRound(roundId: string, userId: string) {
    // Only the host can delete the round.
    const existing = await prisma.round.findFirst({ where: { id: roundId, userId }, select: { id: true } });
    if (!existing) return false;
    await prisma.round.delete({ where: { id: roundId } });
    return true;
  }
};
