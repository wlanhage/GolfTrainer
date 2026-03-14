import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { usersRepository } from '../users/users.repository.js';
import { followsRepository } from './follows.repository.js';

const ensureUserExists = async (userId: string, message = 'User not found') => {
  const user = await usersRepository.getById(userId);
  if (!user) throw new NotFoundError(message);
};

export const followsService = {
  async followUser(followerUserId: string, followingUserId: string) {
    if (followerUserId === followingUserId) {
      throw new BadRequestError('Users cannot follow themselves');
    }

    await ensureUserExists(followingUserId, 'User to follow not found');

    return followsRepository.followUser(followerUserId, followingUserId);
  },

  unfollowUser(followerUserId: string, followingUserId: string) {
    if (followerUserId === followingUserId) {
      throw new BadRequestError('Users cannot unfollow themselves');
    }

    return followsRepository.unfollowUser(followerUserId, followingUserId);
  },

  async isFollowing(followerUserId: string, followingUserId: string) {
    await ensureUserExists(followingUserId);
    const follow = await followsRepository.isFollowing(followerUserId, followingUserId);
    return { isFollowing: Boolean(follow) };
  },

  async getFollowers(userId: string, limit: number, offset: number) {
    await ensureUserExists(userId);
    const rows = await followsRepository.getFollowers(userId, limit, offset);
    return rows.map((row) => ({
      userId: row.follower.id,
      username: row.follower.profile?.displayName ?? row.follower.email,
      followedAt: row.createdAt
    }));
  },

  async getFollowing(userId: string, limit: number, offset: number) {
    await ensureUserExists(userId);
    const rows = await followsRepository.getFollowing(userId, limit, offset);
    return rows.map((row) => ({
      userId: row.following.id,
      username: row.following.profile?.displayName ?? row.following.email,
      followedAt: row.createdAt
    }));
  },

  async getFollowCounts(userId: string) {
    await ensureUserExists(userId);
    const [followers, following] = await followsRepository.getFollowCounts(userId);
    return {
      userId,
      followerCount: followers,
      followingCount: following
    };
  },

  getFollowedLeaderboard(viewerUserId: string, limit: number, offset: number) {
    return followsRepository.getFollowedLeaderboard(viewerUserId, limit, offset);
  },

  getFollowedCourseLeaderboard(viewerUserId: string, courseId: string, limit: number, offset: number) {
    return followsRepository.getFollowedCourseLeaderboard(viewerUserId, courseId, limit, offset);
  },

  getFollowingFeed(viewerUserId: string, limit: number, offset: number) {
    return followsRepository.getFollowingFeed(viewerUserId, limit, offset);
  }
};
