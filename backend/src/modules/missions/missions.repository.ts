import { prisma } from '../../infrastructure/prisma/client.js';

// Hjälpare: returnerar bästa entry per userId, sorterat efter score-riktning.
// Lägre score = bättre när scoreDirection === 'ASC' (t.ex. färre putts).
async function readLeaderboard(missionTemplateId: string, limit: number) {
  const template = await prisma.missionTemplate.findUnique({
    where: { id: missionTemplateId },
    select: { scoreDirection: true, leaderboard: { select: { isActive: true } } }
  });
  if (!template) return [];
  if (template.leaderboard && template.leaderboard.isActive === false) return [];

  const direction = template.scoreDirection;

  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    userId: string;
    score: string;
    submittedAt: Date;
    displayName: string | null;
    email: string;
  }>>(
    `
      SELECT DISTINCT ON ("userId")
        me.id,
        me."userId",
        me.score::text AS score,
        me."submittedAt",
        up."displayName",
        u.email
      FROM "MissionEntry" me
      JOIN "User" u ON u.id = me."userId"
      LEFT JOIN "UserProfile" up ON up."userId" = u.id
      WHERE me."missionTemplateId" = $1
      ORDER BY "userId", me.score ${direction === 'ASC' ? 'ASC' : 'DESC'}, me."submittedAt" ASC
    `,
    missionTemplateId
  );

  rows.sort((a, b) => {
    const sa = Number(a.score);
    const sb = Number(b.score);
    return direction === 'ASC' ? sa - sb : sb - sa;
  });

  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    userId: row.userId,
    score: Number(row.score),
    submittedAt: row.submittedAt,
    playerName: row.displayName ?? row.email
  }));
}

export const missionsRepository = {
  async listForTrainingNavigation() {
    const now = new Date();
    const missions = await prisma.missionTemplate.findMany({
      where: {
        status: 'PUBLISHED',
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    return Promise.all(
      missions.map(async (mission) => ({
        ...mission,
        leaderboardEntries: await readLeaderboard(mission.id, 10)
      }))
    );
  },

  async getById(id: string) {
    const mission = await prisma.missionTemplate.findUnique({ where: { id } });
    if (!mission) return null;
    return {
      ...mission,
      leaderboardEntries: await readLeaderboard(id, 25)
    };
  },

  listAllForAdmin() {
    return prisma.missionTemplate.findMany({
      include: { leaderboard: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  createByAdmin(createdByUserId: string, data: {
    slug: string;
    name: string;
    description: string;
    icon: string;
    objective: string;
    scoreLabel: string;
    scoreInputType: 'STEPPER' | 'MANUAL_NUMBER';
    scoreDirection?: 'ASC' | 'DESC';
    stepperMin?: number;
    stepperMax?: number;
    defaultScore?: number;
    maxScore?: number;
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    startsAt?: string;
    endsAt?: string;
    leaderboardTitle?: string;
    leaderboardActive?: boolean;
  }) {
    return prisma.missionTemplate.create({
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        icon: data.icon,
        objective: data.objective,
        scoreLabel: data.scoreLabel,
        scoreInputType: data.scoreInputType,
        scoreDirection: data.scoreDirection ?? 'DESC',
        stepperMin: data.stepperMin,
        stepperMax: data.stepperMax,
        defaultScore: data.defaultScore,
        maxScore: data.maxScore,
        status: data.status,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        createdByUserId,
        leaderboard: {
          create: {
            title: data.leaderboardTitle,
            isActive: data.leaderboardActive ?? true
          }
        }
      },
      include: { leaderboard: true }
    });
  },

  updateByAdmin(id: string, data: {
    slug?: string;
    name?: string;
    description?: string;
    icon?: string;
    objective?: string;
    scoreLabel?: string;
    scoreInputType?: 'STEPPER' | 'MANUAL_NUMBER';
    scoreDirection?: 'ASC' | 'DESC';
    stepperMin?: number;
    stepperMax?: number;
    defaultScore?: number;
    maxScore?: number;
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    startsAt?: string;
    endsAt?: string;
    leaderboardTitle?: string;
    leaderboardActive?: boolean;
  }) {
    return prisma.missionTemplate.update({
      where: { id },
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        icon: data.icon,
        objective: data.objective,
        scoreLabel: data.scoreLabel,
        scoreInputType: data.scoreInputType,
        scoreDirection: data.scoreDirection,
        stepperMin: data.stepperMin,
        stepperMax: data.stepperMax,
        defaultScore: data.defaultScore,
        maxScore: data.maxScore,
        status: data.status,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        leaderboard: data.leaderboardTitle !== undefined || data.leaderboardActive !== undefined
          ? {
              upsert: {
                create: {
                  title: data.leaderboardTitle,
                  isActive: data.leaderboardActive ?? true
                },
                update: {
                  title: data.leaderboardTitle,
                  isActive: data.leaderboardActive
                }
              }
            }
          : undefined
      },
      include: { leaderboard: true }
    });
  },

  deleteByAdmin(id: string) {
    return prisma.missionTemplate.delete({ where: { id } });
  },

  // === Entry management ===

  createEntry(userId: string, missionTemplateId: string, score: number, notes?: string) {
    return prisma.missionEntry.create({
      data: { userId, missionTemplateId, score, notes: notes ?? null }
    });
  },

  async listMyHistory(userId: string, missionTemplateId: string, limit: number) {
    const entries = await prisma.missionEntry.findMany({
      where: { userId, missionTemplateId },
      orderBy: { submittedAt: 'desc' },
      take: limit
    });
    return entries.map((e) => ({
      id: e.id,
      score: Number(e.score),
      notes: e.notes,
      submittedAt: e.submittedAt
    }));
  },

  async getUserBest(userId: string, missionTemplateId: string, direction: 'ASC' | 'DESC') {
    const entry = await prisma.missionEntry.findFirst({
      where: { userId, missionTemplateId },
      orderBy: [{ score: direction === 'ASC' ? 'asc' : 'desc' }, { submittedAt: 'asc' }]
    });
    return entry ? Number(entry.score) : null;
  },

  /**
   * Returnerar rank för ett score givet score-riktning.
   * Räknar antal användare med strikt bättre PB än `score`, plus 1.
   */
  async getRankForScore(missionTemplateId: string, score: number, direction: 'ASC' | 'DESC'): Promise<number> {
    const comparator = direction === 'ASC' ? '<' : '>';
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `
        SELECT COUNT(*)::bigint AS count FROM (
          SELECT DISTINCT ON ("userId") "userId", score
          FROM "MissionEntry"
          WHERE "missionTemplateId" = $1
          ORDER BY "userId", score ${direction === 'ASC' ? 'ASC' : 'DESC'}, "submittedAt" ASC
        ) AS best
        WHERE best.score ${comparator} $2
      `,
      missionTemplateId,
      score
    );
    return Number(rows[0]?.count ?? 0n) + 1;
  }
};
