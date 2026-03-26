import { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../common/middleware/admin.middleware.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { coursesController } from './courses.controller.js';

export async function coursesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/', coursesController.list);
  app.get('/:id', coursesController.getById);

  app.post('/', { preHandler: [requireAdmin] }, coursesController.create);
  app.patch('/:id', { preHandler: [requireAdmin] }, coursesController.update);
  app.delete('/:id', { preHandler: [requireAdmin] }, coursesController.remove);
  app.post('/:id/holes', { preHandler: [requireAdmin] }, coursesController.ensureHoles);
  app.patch('/:id/holes/:holeNumber', { preHandler: [requireAdmin] }, coursesController.updateHoleMeta);
  app.patch('/:id/holes/:holeNumber/layout', { preHandler: [requireAdmin] }, coursesController.updateHoleLayout);
}
