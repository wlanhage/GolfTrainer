import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { usersRepository } from '../users/users.repository.js';
import { followsRepository } from './follows.repository.js';
import { followsService } from './follows.service.js';

const usersRepo = usersRepository as any;
const followsRepo = followsRepository as any;

test('followsService.followUser rejects self follow', async () => {
  await assert.rejects(() => followsService.followUser('user-1', 'user-1'), BadRequestError);
});

test('followsService.followUser rejects missing target user', async () => {
  const originalGetById = usersRepo.getById;
  usersRepo.getById = async () => null;

  await assert.rejects(() => followsService.followUser('user-1', 'user-2'), NotFoundError);

  usersRepo.getById = originalGetById;
});

test('followsService.isFollowing maps repository result to boolean', async () => {
  const originalGetById = usersRepo.getById;
  const originalIsFollowing = followsRepo.isFollowing;
  usersRepo.getById = async () => ({ id: 'user-2' });
  followsRepo.isFollowing = async () => ({ id: 'follow-1' });

  const result = await followsService.isFollowing('user-1', 'user-2');
  assert.equal(result.isFollowing, true);

  usersRepo.getById = originalGetById;
  followsRepo.isFollowing = originalIsFollowing;
});

test('followsService.getFollowers rejects missing profile user', async () => {
  const originalGetById = usersRepo.getById;
  usersRepo.getById = async () => null;

  await assert.rejects(() => followsService.getFollowers('user-2', 20, 0), NotFoundError);

  usersRepo.getById = originalGetById;
});
