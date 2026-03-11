import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundError } from '../../common/errors/AppError.js';
import { usersRepository } from './users.repository.js';
import { usersService } from './users.service.js';

const repo = usersRepository as any;

test('usersService.getMe throws when user does not exist', async () => {
  const original = repo.getMe;
  repo.getMe = async () => null;

  await assert.rejects(() => usersService.getMe('user-1'), NotFoundError);

  repo.getMe = original;
});

test('usersService.updateMe upserts then returns profile payload', async () => {
  const originalUpsert = repo.upsertProfile;
  const originalGetMe = repo.getMe;

  let upserted = false;
  repo.upsertProfile = async () => {
    upserted = true;
    return {};
  };
  repo.getMe = async () => ({
    id: 'user-1',
    email: 'player@example.com',
    profile: { displayName: 'Player' }
  });

  const result = await usersService.updateMe('user-1', { displayName: 'Player' });
  assert.equal(upserted, true);
  assert.equal(result.email, 'player@example.com');

  repo.upsertProfile = originalUpsert;
  repo.getMe = originalGetMe;
});
