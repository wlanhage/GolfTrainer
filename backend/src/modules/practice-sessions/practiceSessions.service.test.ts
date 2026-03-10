import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundError } from '../../common/errors/AppError.js';
import { practiceSessionsRepository } from './practiceSessions.repository.js';
import { practiceSessionsService } from './practiceSessions.service.js';

const repo = practiceSessionsRepository as any;

test('practiceSessionsService.getById throws when session is missing', async () => {
  const original = repo.getById;
  repo.getById = async () => null;

  await assert.rejects(() => practiceSessionsService.getById('user-1', 'session-1'), NotFoundError);

  repo.getById = original;
});

test('practiceSessionsService.update returns fetched session after update', async () => {
  const originalUpdate = repo.update;
  const originalGet = repo.getById;

  repo.update = async () => ({ count: 1 });
  repo.getById = async () => ({ id: 'session-1', title: 'Range' });

  const result = await practiceSessionsService.update('user-1', 'session-1', { title: 'Range' });
  assert.deepEqual(result, { id: 'session-1', title: 'Range' });

  repo.update = originalUpdate;
  repo.getById = originalGet;
});
