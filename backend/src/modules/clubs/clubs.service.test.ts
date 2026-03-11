import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundError } from '../../common/errors/AppError.js';
import { clubsRepository } from './clubs.repository.js';
import { clubsService } from './clubs.service.js';

const repo = clubsRepository as any;

test('clubsService.getById throws when club is missing', async () => {
  const original = repo.getById;
  repo.getById = async () => null;

  await assert.rejects(() => clubsService.getById('user-1', 'club-1'), NotFoundError);

  repo.getById = original;
});

test('clubsService.update returns latest club after update', async () => {
  const originalUpdate = repo.update;
  const originalGet = repo.getById;

  repo.update = async () => ({ count: 1 });
  repo.getById = async () => ({ id: 'club-1', label: '7 Iron' });

  const result = await clubsService.update('user-1', 'club-1', { label: '7 Iron' });
  assert.deepEqual(result, { id: 'club-1', label: '7 Iron' });

  repo.update = originalUpdate;
  repo.getById = originalGet;
});
