import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { roundsController } from './rounds.controller.js';

export async function roundsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/', roundsController.list);
  app.post('/', roundsController.create);
  app.get('/:roundId', roundsController.getById);
  app.get('/:roundId/public', roundsController.getByIdPublic);
  app.patch('/:roundId', roundsController.update);
  app.patch('/:roundId/image', roundsController.setImage);
  app.post('/:roundId/leave', roundsController.leave);
  app.delete('/:roundId', roundsController.remove);
  app.patch('/:roundId/holes/:holeNumber', roundsController.updateHole);
  app.patch('/:roundId/holes/:holeNumber/scores/:playerId', roundsController.updatePlayerScore);

  // Round shots
  app.post('/:roundId/shots', roundsController.createShot);
  app.get('/:roundId/shots', roundsController.listShots);
  app.delete('/:roundId/shots/:shotId', roundsController.deleteShot);
}
