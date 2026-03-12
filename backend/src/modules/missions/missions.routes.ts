import { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../common/middleware/admin.middleware.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { missionsController } from './missions.controller.js';

export async function missionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/admin/all', { preHandler: [requireAdmin] }, missionsController.adminList);
  app.post('/admin/all', { preHandler: [requireAdmin] }, missionsController.adminCreate);
  app.patch('/admin/all/:missionId', { preHandler: [requireAdmin] }, missionsController.adminUpdate);
  app.delete('/admin/all/:missionId', { preHandler: [requireAdmin] }, missionsController.adminRemove);

  app.get('/', missionsController.list);
  app.get('/:missionId', missionsController.getById);
}
