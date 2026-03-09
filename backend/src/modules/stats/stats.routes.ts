import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { statsController } from './stats.controller.js';

export async function statsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/overview', statsController.overview);
  app.get('/clubs/average-carry', statsController.averageCarryPerClub);
  app.get('/drills/success-rate', statsController.successRatePerDrill);
  app.get('/trends', statsController.trend);
}
