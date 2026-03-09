import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { clubsController } from './clubs.controller.js';

export async function clubsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', clubsController.create);
  app.get('/', clubsController.list);
  app.get('/:clubId', clubsController.getById);
  app.patch('/:clubId', clubsController.update);
  app.delete('/:clubId', clubsController.remove);
}
