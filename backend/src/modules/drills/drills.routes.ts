import { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../common/middleware/admin.middleware.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { drillsController } from './drills.controller.js';

export async function drillsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', drillsController.create);
  app.get('/', drillsController.list);
  app.get('/:drillId', drillsController.getById);
  app.patch('/:drillId', drillsController.update);
  app.delete('/:drillId', drillsController.remove);

  app.get('/admin/all', { preHandler: [requireAdmin] }, drillsController.adminList);
  app.post('/admin/all', { preHandler: [requireAdmin] }, drillsController.adminCreate);
  app.patch('/admin/all/:drillId', { preHandler: [requireAdmin] }, drillsController.adminUpdate);
  app.delete('/admin/all/:drillId', { preHandler: [requireAdmin] }, drillsController.adminRemove);
}
