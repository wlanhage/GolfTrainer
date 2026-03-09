import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { drillsController } from './drills.controller.js';

export async function drillsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', drillsController.create);
  app.get('/', drillsController.list);
  app.get('/:drillId', drillsController.getById);
  app.patch('/:drillId', drillsController.update);
  app.delete('/:drillId', drillsController.remove);
}
