import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { followsController } from './follows.controller.js';

export async function followsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.post('/:targetUserId', followsController.followUser);
  app.delete('/:targetUserId', followsController.unfollowUser);
  app.get('/:targetUserId/status', followsController.isFollowing);

  app.get('/profiles/:userId/followers', followsController.listFollowers);
  app.get('/profiles/:userId/following', followsController.listFollowing);
  app.get('/profiles/:userId/counts', followsController.getFollowCounts);

  app.get('/leaderboards/following', followsController.followedLeaderboard);
  app.get('/leaderboards/following/by-course', followsController.followedCourseLeaderboard);

  app.get('/feed/following-rounds', followsController.followingFeed);
}
