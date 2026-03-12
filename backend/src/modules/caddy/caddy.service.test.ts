import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenError } from '../../common/errors/AppError.js';
import { usersRepository } from '../users/users.repository.js';
import { caddyRepository } from './caddy.repository.js';
import { caddyService } from './caddy.service.js';

const usersRepo = usersRepository as any;
const repo = caddyRepository as any;

test('caddyService applies 5% trim per side for clubs with more than 20 shots', async () => {
  const originalList = repo.listShotsByUser;

  const shots = Array.from({ length: 21 }).map((_, index) => ({
    id: `shot-${index}`,
    userClub: { label: 'Driver' },
    carryMeters: index === 20 ? 1000 : 200,
    curveDeg: index,
    notes: JSON.stringify({ peakHeightMeters: 30, spinRpm: 2400 }),
    recordedAt: new Date('2026-01-01T00:00:00.000Z')
  }));

  repo.listShotsByUser = async () => shots;

  const summaries = await caddyService.listClubSummaries('user-1');
  const driver = summaries.find((item) => item.clubKey === 'driver');

  assert.equal(driver?.sampleCount, 21);
  assert.equal(driver?.trimPercentEachSide, 5);
  assert.equal(driver?.trimmedSampleCount, 19);
  assert.equal(driver?.distanceMeters, 200);

  repo.listShotsByUser = originalList;
});

test('caddyService blocks non-admin from reading another player caddy data', async () => {
  const originalGetById = usersRepo.getById;

  usersRepo.getById = async () => ({ id: 'user-1', role: 'USER' });

  await assert.rejects(() => caddyService.listClubSummaries('user-1', 'user-2'), ForbiddenError);

  usersRepo.getById = originalGetById;
});
