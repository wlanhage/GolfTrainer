import { prisma } from '../../infrastructure/prisma/client.js';

const sinceDate = (rangeDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() - rangeDays);
  return d;
};

export const statsRepository = {
  async averageCarryPerClub(userId: string, rangeDays: number) {
    const since = sinceDate(rangeDays);

    const grouped = await prisma.shotEntry.groupBy({
      by: ['userClubId'],
      where: {
        userId,
        recordedAt: { gte: since },
        carryMeters: { not: null }
      },
      _avg: { carryMeters: true },
      _count: { userClubId: true }
    });

    const clubs = await prisma.userClub.findMany({
      where: {
        userId,
        id: { in: grouped.map((g) => g.userClubId) }
      },
      select: { id: true, label: true }
    });

    const byId = new Map(clubs.map((c) => [c.id, c.label]));

    return grouped.map((g) => ({
      userClubId: g.userClubId,
      clubLabel: byId.get(g.userClubId) ?? 'Unknown club',
      averageCarryMeters: Number(g._avg.carryMeters ?? 0),
      sampleSize: g._count.userClubId
    }));
  },

  successRatePerDrill(userId: string, rangeDays: number) {
    const since = sinceDate(rangeDays);

    return prisma.drillAttempt.groupBy({
      by: ['drillId'],
      where: { userId, attemptedAt: { gte: since } },
      _sum: { successCount: true, attemptCount: true },
      _count: { drillId: true }
    });
  },

  async drillLabelsVisibleForUser(userId: string, drillIds: string[]) {
    return prisma.drill.findMany({
      where: {
        id: { in: drillIds },
        OR: [{ userId }, { isPublic: true }]
      },
      select: { id: true, name: true }
    });
  },

  shotsByDay(userId: string, rangeDays: number) {
    const since = sinceDate(rangeDays);

    return prisma.$queryRaw<Array<{ day: Date; shots: number; avg_carry: number | null }>>`
      SELECT DATE_TRUNC('day', "recordedAt") AS day,
             COUNT(*)::int AS shots,
             AVG("carryMeters")::float AS avg_carry
      FROM "ShotEntry"
      WHERE "userId" = ${userId}
        AND "recordedAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "recordedAt")
      ORDER BY day ASC
    `;
  },

  drillProgressByDay(userId: string, rangeDays: number) {
    const since = sinceDate(rangeDays);

    return prisma.$queryRaw<Array<{ day: Date; success_sum: number; attempt_sum: number }>>`
      SELECT DATE_TRUNC('day', "attemptedAt") AS day,
             COALESCE(SUM("successCount"), 0)::int AS success_sum,
             COALESCE(SUM("attemptCount"), 0)::int AS attempt_sum
      FROM "DrillAttempt"
      WHERE "userId" = ${userId}
        AND "attemptedAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "attemptedAt")
      ORDER BY day ASC
    `;
  },

  async dashboardOverview(userId: string, rangeDays: number) {
    const since = sinceDate(rangeDays);

    const [shotsCount, sessionsCount, attemptsAgg] = await Promise.all([
      prisma.shotEntry.count({ where: { userId, recordedAt: { gte: since } } }),
      prisma.practiceSession.count({ where: { userId, startedAt: { gte: since } } }),
      prisma.drillAttempt.aggregate({
        where: { userId, attemptedAt: { gte: since } },
        _sum: { successCount: true, attemptCount: true }
      })
    ]);

    return {
      shotsCount,
      sessionsCount,
      drillSuccessCount: attemptsAgg._sum.successCount ?? 0,
      drillAttemptCount: attemptsAgg._sum.attemptCount ?? 0
    };
  }
};
