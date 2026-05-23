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

  /** Public read-only — any authenticated user can view any round. */
  getByIdPublic(roundId: string) {
    return prisma.round.findUnique({
      where: { id: roundId },
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

  /**
   * Sätter rundans image. Endast hosten (Round.userId) får ändra, och bara
   * om image är null — när den är satt en gång kan den inte ändras.
   */
  async setImage(roundId: string, userId: string, image: string) {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { userId: true, image: true }
    });
    if (!round) return { ok: false as const, reason: 'not_found' as const };
    if (round.userId !== userId) return { ok: false as const, reason: 'forbidden' as const };
    if (round.image !== null) return { ok: false as const, reason: 'already_set' as const };
    const updated = await prisma.round.update({
      where: { id: roundId },
      data: { image },
      include: ROUND_INCLUDE
    });
    return { ok: true as const, round: updated };
  },

  async updateRoundHole(
    roundId: string,
    userId: string,
    holeNumber: number,
    patch: { notes?: string | null; completedAt?: Date | null }
  ) {
    const allowed = await this.hasAccess(roundId, userId);
    if (!allowed) return null;
    return prisma.roundHole.update({
      where: { roundId_holeNumber: { roundId, holeNumber } },
      data: patch
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
    // Compute from the host player's RoundHoleScore rows.
    const hostPlayer = await prisma.roundPlayer.findFirst({
      where: { roundId, isHost: true },
      select: { id: true }
    });
    if (!hostPlayer) return null;

    const result = await prisma.roundHoleScore.aggregate({
      where: { playerId: hostPlayer.id, strokes: { not: null } },
      _sum: { strokes: true },
      _count: { _all: true }
    });
    if (result._count._all === 0) return null;
    return result._sum.strokes ?? 0;
  },

  async deleteRound(roundId: string, userId: string) {
    // Only the host can delete the round.
    const existing = await prisma.round.findFirst({ where: { id: roundId, userId }, select: { id: true } });
    if (!existing) return false;
    await prisma.round.delete({ where: { id: roundId } });
    return true;
  }
};
