import { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../common/middleware/admin.middleware.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { usersController } from './users.controller.js';

export async function usersRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: [requireAuth] }, usersController.me);
  app.patch('/me', { preHandler: [requireAuth] }, usersController.updateMe);

  app.get('/', { preHandler: [requireAuth, requireAdmin] }, usersController.adminList);
  app.patch('/:userId', { preHandler: [requireAuth, requireAdmin] }, usersController.adminUpdateById);
}
