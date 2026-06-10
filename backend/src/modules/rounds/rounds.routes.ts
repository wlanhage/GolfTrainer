import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { requireAdmin } from '../../common/middleware/admin.middleware.js';
import { roundsController } from './rounds.controller.js';

export async function roundsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // Admin endpoints — must be declared before generic /:roundId routes
  // so Fastify routes "/admin/stats" and "/admin" don't get captured by
  // the param route. Both require admin role.
  app.get('/admin/stats', { preHandler: [requireAdmin] }, roundsController.adminStats);
  app.get('/admin', { preHandler: [requireAdmin] }, roundsController.adminList);
  app.post('/admin/:roundId/recompute-total', { preHandler: [requireAdmin] }, roundsController.adminRecomputeTotalScore);

  // Watch companion: literal `/active` must be declared before `/:roundId`
  // so it isn't captured as a round id.
  app.get('/active', roundsController.getActive);

  app.get('/', roundsController.list);
  app.post('/', roundsController.create);
  app.get('/:roundId', roundsController.getById);
  app.get('/:roundId/public', roundsController.getByIdPublic);
  app.patch('/:roundId', roundsController.update);
  app.patch('/:roundId/image', roundsController.setImage);
  app.post('/:roundId/leave', roundsController.leave);
  app.post('/:roundId/next-hole', roundsController.nextHole);
  app.delete('/:roundId', roundsController.remove);
  app.patch('/:roundId/holes/:holeNumber', roundsController.updateHole);
  app.patch('/:roundId/holes/:holeNumber/strokes', roundsController.updateStrokes);
  app.patch('/:roundId/holes/:holeNumber/scores/:playerId', roundsController.updatePlayerScore);

  // Round shots
  app.post('/:roundId/shots', roundsController.createShot);
  app.get('/:roundId/shots', roundsController.listShots);
  app.delete('/:roundId/shots/:shotId', roundsController.deleteShot);
}
