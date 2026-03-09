import { statsRepository } from './stats.repository.js';

export const statsService = {
  averageCarryPerClub(userId: string, rangeDays: number) {
    return statsRepository.averageCarryPerClub(userId, rangeDays);
  },

  async successRatePerDrill(userId: string, rangeDays: number) {
    const grouped = await statsRepository.successRatePerDrill(userId, rangeDays);
    const labels = await statsRepository.drillLabelsVisibleForUser(
      userId,
      grouped.map((g) => g.drillId)
    );

    const byId = new Map(labels.map((d) => [d.id, d.name]));

    return grouped.map((g) => {
      const success = g._sum.successCount ?? 0;
      const total = g._sum.attemptCount ?? 0;
      const successPercentage = total > 0 ? (success / total) * 100 : 0;

      return {
        drillId: g.drillId,
        drillName: byId.get(g.drillId) ?? 'Unknown drill',
        successfulAttempts: success,
        totalAttempts: total,
        attemptEntries: g._count.drillId,
        successPercentage
      };
    });
  },

  async trendLastDays(userId: string, rangeDays: number) {
    const [shotSeries, drillSeries] = await Promise.all([
      statsRepository.shotsByDay(userId, rangeDays),
      statsRepository.drillProgressByDay(userId, rangeDays)
    ]);

    const byDay = new Map<string, {
      day: string;
      shots: number;
      averageCarryMeters: number | null;
      drillSuccessfulAttempts: number;
      drillTotalAttempts: number;
      drillSuccessPercentage: number | null;
    }>();

    for (const point of shotSeries) {
      const day = new Date(point.day).toISOString().slice(0, 10);
      byDay.set(day, {
        day,
        shots: point.shots,
        averageCarryMeters: point.avg_carry,
        drillSuccessfulAttempts: 0,
        drillTotalAttempts: 0,
        drillSuccessPercentage: null
      });
    }

    for (const point of drillSeries) {
      const day = new Date(point.day).toISOString().slice(0, 10);
      const existing = byDay.get(day) ?? {
        day,
        shots: 0,
        averageCarryMeters: null,
        drillSuccessfulAttempts: 0,
        drillTotalAttempts: 0,
        drillSuccessPercentage: null
      };

      const success = Number(point.success_sum);
      const total = Number(point.attempt_sum);
      existing.drillSuccessfulAttempts = success;
      existing.drillTotalAttempts = total;
      existing.drillSuccessPercentage = total > 0 ? (success / total) * 100 : null;
      byDay.set(day, existing);
    }

    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  },

  async dashboardOverview(userId: string, rangeDays: number) {
    const overview = await statsRepository.dashboardOverview(userId, rangeDays);
    const drillSuccessPercentage =
      overview.drillAttemptCount > 0
        ? (overview.drillSuccessCount / overview.drillAttemptCount) * 100
        : 0;

    return {
      rangeDays,
      shotsCount: overview.shotsCount,
      sessionsCount: overview.sessionsCount,
      drillSuccessfulAttempts: overview.drillSuccessCount,
      drillTotalAttempts: overview.drillAttemptCount,
      drillSuccessPercentage
    };
  }
};
