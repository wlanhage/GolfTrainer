import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { shotsController } from './shots.controller.js';

export async function shotsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', shotsController.create);
  app.get('/', shotsController.list);
  app.get('/:shotId', shotsController.getById);
  app.patch('/:shotId', shotsController.update);
  app.delete('/:shotId', shotsController.remove);
}
