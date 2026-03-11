import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { shotsRepository } from './shots.repository.js';
import { shotsService } from './shots.service.js';

const repo = shotsRepository as any;

test('shotsService.create throws when club is not owned', async () => {
  const originalGetOwnedClub = repo.getOwnedClub;
  repo.getOwnedClub = async () => null;

  await assert.rejects(() => shotsService.create('user-1', {
    userClubId: 'club-1',
    recordedAt: new Date('2025-01-01T00:00:00.000Z')
  }), NotFoundError);

  repo.getOwnedClub = originalGetOwnedClub;
});

test('shotsService.update rejects negative carryMeters', async () => {
  await assert.rejects(() => shotsService.update('user-1', 'shot-1', {
    carryMeters: -1
  }), BadRequestError);
});
