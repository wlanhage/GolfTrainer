import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { usersRepository } from '../users/users.repository.js';
import { followsRepository } from './follows.repository.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { roundsRepository } from '../rounds/rounds.repository.js';

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

    const follow = await followsRepository.followUser(followerUserId, followingUserId);

    // Notify the person who got followed — fire-and-forget, in-app + push
    // are both fired by notificationsService.notifyNewFollower.
    const follower = await usersRepository.getMe(followerUserId);
    const followerName = follower?.profile?.displayName ?? follower?.email ?? 'Någon';
    notificationsService
      .notifyNewFollower(followingUserId, followerName, followerUserId)
      .catch(() => undefined);

    return follow;
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

  async getFollowingFeed(viewerUserId: string, limit: number, offset: number) {
    const rows = await followsRepository.getFollowingFeed(viewerUserId, limit, offset);
    const reactions = await roundsRepository.listReactionsForRounds(rows.map((r) => r.roundId));
    const byRound = new Map<string, Array<{ emoji: string; playerId: string; userId: string; displayName: string; avatarImage: string | null }>>();
    for (const reaction of reactions) {
      const list = byRound.get(reaction.roundId) ?? [];
      list.push({
        emoji: reaction.emoji,
        playerId: reaction.playerId,
        userId: reaction.user.id,
        displayName: reaction.user.profile?.displayName ?? reaction.user.email,
        avatarImage: reaction.user.profile?.avatarImage ?? null
      });
      byRound.set(reaction.roundId, list);
    }
    return rows.map((row) => ({ ...row, reactions: byRound.get(row.roundId) ?? [] }));
  },

  getMutualFollowers(userId: string) {
    return followsRepository.getMutualFollowers(userId);
  }
};
