import { prisma } from '../../infrastructure/prisma/client.js';
import type { Prisma, RoundFormat } from '@prisma/client';

type CreateRoundPlayerData = {
  userId: string;
  displayNameSnapshot: string;
  team: string | null;
  order: number;
  isHost?: boolean;
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
            order: p.order,
            // Fallback: if caller didn't explicitly mark a host, treat the
            // player whose userId matches Round.userId as the host.
            isHost: p.isHost ?? p.userId === data.hostUserId
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
   * Admin-vyn: listar ALLA rundor i systemet, oavsett host/players.
   * Stödjer status-filter och paginering. Inkluderar host-user för att
   * dashboard ska kunna visa "vem"-kolumn utan extra joins.
   */
  adminListAll(opts: {
    status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
    limit: number;
    offset: number;
  }) {
    return prisma.round.findMany({
      where: opts.status ? { status: opts.status } : {},
      orderBy: { startedAt: 'desc' },
      take: opts.limit,
      skip: opts.offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true } }
          }
        },
        _count: { select: { players: true } }
      }
    });
  },

  /**
   * Admin-statistik: counts grupperade efter status + totalsumma.
   *
   * Sekventiella queries (inte Promise.all) för att minimera samtidiga
   * connections — PgBouncer i session mode har bara 15 klienter. Slår
   * också ihop alla user-counts i en enda groupBy (efter role) plus en
   * count för aktiva. Tre user.count() → en groupBy + en count.
   */
  async adminStats() {
    const byStatus = await prisma.round.groupBy({
      by: ['status'],
      _count: { _all: true }
    });

    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true }
    });

    const activeUsers = await prisma.user.count({ where: { isActive: true } });

    const roundCounts: Record<'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED', number> = {
      IN_PROGRESS: 0,
      COMPLETED: 0,
      ABANDONED: 0
    };
    for (const row of byStatus) roundCounts[row.status] = row._count._all;

    let totalUsers = 0;
    let admins = 0;
    for (const row of usersByRole) {
      totalUsers += row._count._all;
      if (row.role === 'ADMIN') admins = row._count._all;
    }

    return {
      users: { total: totalUsers, active: activeUsers, admins },
      rounds: {
        inProgress: roundCounts.IN_PROGRESS,
        completed: roundCounts.COMPLETED,
        abandoned: roundCounts.ABANDONED,
        total: roundCounts.IN_PROGRESS + roundCounts.COMPLETED + roundCounts.ABANDONED
      }
    };
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
   * Markerar att en spelare har lämnat rundan. Sätter leftAt på RoundPlayer
   * där userId matchar. Hosten får också lämna sig själv — rundan fortsätter
   * för övriga aktiva spelare.
   */
  async markPlayerLeft(roundId: string, userId: string) {
    const player = await prisma.roundPlayer.findFirst({
      where: { roundId, userId },
      select: { id: true, leftAt: true }
    });
    if (!player) return { ok: false as const, reason: 'not_found' as const };
    if (player.leftAt !== null) return { ok: false as const, reason: 'already_left' as const };
    await prisma.roundPlayer.update({
      where: { id: player.id },
      data: { leftAt: new Date() }
    });
    return { ok: true as const };
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
    // Find the host player. Primary lookup: isHost flag. Fallback (for
    // older rounds created before isHost was being set): match the
    // RoundPlayer whose userId equals Round.userId.
    let hostPlayer = await prisma.roundPlayer.findFirst({
      where: { roundId, isHost: true },
      select: { id: true }
    });

    if (!hostPlayer) {
      const round = await prisma.round.findUnique({
        where: { id: roundId },
        select: { userId: true }
      });
      if (round) {
        hostPlayer = await prisma.roundPlayer.findFirst({
          where: { roundId, userId: round.userId },
          select: { id: true }
        });
      }
    }
    if (!hostPlayer) return null;

    const result = await prisma.roundHoleScore.aggregate({
      where: { playerId: hostPlayer.id, strokes: { not: null } },
      _sum: { strokes: true },
      _count: { _all: true }
    });
    if (result._count._all === 0) return null;
    return result._sum.strokes ?? 0;
  },

  /**
   * Admin: räkna om totalScore för en runda och skriv tillbaka till DB.
   * Används för att laga rundor som blev COMPLETED med totalScore=null
   * pga den gamla buggen där isHost aldrig sattes.
   */
  async adminRecomputeTotalScore(roundId: string) {
    const total = await this.computeTotalScore(roundId);
    await prisma.round.update({
      where: { id: roundId },
      data: { totalScore: total }
    });
    return total;
  },

  async deleteRound(roundId: string, userId: string) {
    // Only the host can delete the round.
    const existing = await prisma.round.findFirst({ where: { id: roundId, userId }, select: { id: true } });
    if (!existing) return false;
    await prisma.round.delete({ where: { id: roundId } });
    return true;
  }
};
