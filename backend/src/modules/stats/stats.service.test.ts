import assert from 'node:assert/strict';
import test from 'node:test';
import { statsRepository } from './stats.repository.js';
import { statsService } from './stats.service.js';

const repo = statsRepository as any;

test('statsService.successRatePerDrill maps percentages and fallback names', async () => {
  const originalGrouped = repo.successRatePerDrill;
  const originalLabels = repo.drillLabelsVisibleForUser;

  repo.successRatePerDrill = async () => ([
    { drillId: 'd1', _sum: { successCount: 8, attemptCount: 10 }, _count: { drillId: 4 } },
    { drillId: 'd2', _sum: { successCount: null, attemptCount: null }, _count: { drillId: 2 } }
  ]);
  repo.drillLabelsVisibleForUser = async () => ([{ id: 'd1', name: 'Putting ladder' }]);

  const result = await statsService.successRatePerDrill('user-1', 30);

  assert.deepEqual(result, [
    {
      drillId: 'd1',
      drillName: 'Putting ladder',
      successfulAttempts: 8,
      totalAttempts: 10,
      attemptEntries: 4,
      successPercentage: 80
    },
    {
      drillId: 'd2',
      drillName: 'Unknown drill',
      successfulAttempts: 0,
      totalAttempts: 0,
      attemptEntries: 2,
      successPercentage: 0
    }
  ]);

  repo.successRatePerDrill = originalGrouped;
  repo.drillLabelsVisibleForUser = originalLabels;
});

test('statsService.dashboardOverview computes aggregate percentage', async () => {
  const original = repo.dashboardOverview;
  repo.dashboardOverview = async () => ({
    shotsCount: 12,
    sessionsCount: 3,
    drillSuccessCount: 14,
    drillAttemptCount: 20
  });

  const result = await statsService.dashboardOverview('user-1', 14);
  assert.equal(result.drillSuccessPercentage, 70);
  assert.equal(result.rangeDays, 14);

  repo.dashboardOverview = original;
});
