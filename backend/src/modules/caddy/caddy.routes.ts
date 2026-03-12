import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { caddyController } from './caddy.controller.js';

export async function caddyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/clubs', caddyController.listClubSummaries);
  app.get('/clubs/:clubKey/shots', caddyController.listClubShots);
  app.post('/clubs/:clubKey/shots', caddyController.createShot);
  app.delete('/shots/:shotId', caddyController.removeShot);
}
