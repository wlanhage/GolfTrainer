import { FastifyReply, FastifyRequest } from 'fastify';
import {
  followedCourseLeaderboardQuerySchema,
  paginationQuerySchema,
  profileUserParamSchema,
  targetUserParamSchema
} from './follows.schema.js';
import { followsService } from './follows.service.js';

export const followsController = {
  async followUser(request: FastifyRequest, reply: FastifyReply) {
    const { targetUserId } = targetUserParamSchema.parse(request.params);
    const followerUserId = request.auth!.userId;
    const follow = await followsService.followUser(followerUserId, targetUserId);
    return reply.code(201).send(follow);
  },

  async unfollowUser(request: FastifyRequest, reply: FastifyReply) {
    const { targetUserId } = targetUserParamSchema.parse(request.params);
    const followerUserId = request.auth!.userId;
    await followsService.unfollowUser(followerUserId, targetUserId);
    return reply.code(204).send();
  },

  async isFollowing(request: FastifyRequest, reply: FastifyReply) {
    const { targetUserId } = targetUserParamSchema.parse(request.params);
    const followerUserId = request.auth!.userId;
    const result = await followsService.isFollowing(followerUserId, targetUserId);
    return reply.send(result);
  },

  async listFollowers(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = profileUserParamSchema.parse(request.params);
    const { limit, offset } = paginationQuerySchema.parse(request.query ?? {});
    const followers = await followsService.getFollowers(userId, limit, offset);
    return reply.send(followers);
  },

  async listFollowing(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = profileUserParamSchema.parse(request.params);
    const { limit, offset } = paginationQuerySchema.parse(request.query ?? {});
    const following = await followsService.getFollowing(userId, limit, offset);
    return reply.send(following);
  },

  async getFollowCounts(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = profileUserParamSchema.parse(request.params);
    const counts = await followsService.getFollowCounts(userId);
    return reply.send(counts);
  },

  async followedLeaderboard(request: FastifyRequest, reply: FastifyReply) {
    const viewerUserId = request.auth!.userId;
    const { limit, offset } = paginationQuerySchema.parse(request.query ?? {});
    const rows = await followsService.getFollowedLeaderboard(viewerUserId, limit, offset);
    return reply.send(rows);
  },

  async followedCourseLeaderboard(request: FastifyRequest, reply: FastifyReply) {
    const viewerUserId = request.auth!.userId;
    const { courseId, limit, offset } = followedCourseLeaderboardQuerySchema.parse(request.query ?? {});
    const rows = await followsService.getFollowedCourseLeaderboard(viewerUserId, courseId, limit, offset);
    return reply.send(rows);
  },

  async followingFeed(request: FastifyRequest, reply: FastifyReply) {
    const viewerUserId = request.auth!.userId;
    const { limit, offset } = paginationQuerySchema.parse(request.query ?? {});
    const feed = await followsService.getFollowingFeed(viewerUserId, limit, offset);
    return reply.send(feed);
  }
};
