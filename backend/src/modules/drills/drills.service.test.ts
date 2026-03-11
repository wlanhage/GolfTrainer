import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundError } from '../../common/errors/AppError.js';
import { drillsRepository } from './drills.repository.js';
import { drillsService } from './drills.service.js';

const repo = drillsRepository as any;

test('drillsService.getVisibleById throws when drill is missing', async () => {
  const original = repo.getVisibleById;
  repo.getVisibleById = async () => null;

  await assert.rejects(() => drillsService.getVisibleById('user-1', 'drill-1'), NotFoundError);

  repo.getVisibleById = original;
});

test('drillsService.updateOwned throws when update count is zero', async () => {
  const original = repo.updateOwned;
  repo.updateOwned = async () => ({ count: 0 });

  await assert.rejects(() => drillsService.updateOwned('user-1', 'drill-1', { name: 'New' }), NotFoundError);

  repo.updateOwned = original;
});
