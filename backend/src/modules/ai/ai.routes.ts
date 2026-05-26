import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { aiController } from './ai.controller.js';

export async function aiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/caddy-chat', aiController.caddyChat);
  app.post('/recommend-club', { bodyLimit: 10_000_000 }, aiController.recommendClub);
  app.post('/data-recommend-club', aiController.dataRecommendClub);
}
