import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { drillAttemptsRepository } from './drillAttempts.repository.js';
import { drillAttemptsService } from './drillAttempts.service.js';

const repo = drillAttemptsRepository as any;

test('drillAttemptsService.create throws when drill is not owned', async () => {
  const originalOwnsDrill = repo.userOwnsDrill;
  repo.userOwnsDrill = async () => null;

  await assert.rejects(() => drillAttemptsService.create('user-1', {
    drillId: 'drill-1',
    successfulAttempts: 1,
    totalAttempts: 2
  }), NotFoundError);

  repo.userOwnsDrill = originalOwnsDrill;
});

test('drillAttemptsService.update validates success <= total', async () => {
  const originalGetById = repo.getById;
  repo.getById = async () => ({ id: 'a1', successCount: 2, attemptCount: 3 });

  await assert.rejects(() => drillAttemptsService.update('user-1', 'a1', {
    successfulAttempts: 5,
    totalAttempts: 4
  }), BadRequestError);

  repo.getById = originalGetById;
});
