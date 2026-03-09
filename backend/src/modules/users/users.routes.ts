import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { usersController } from './users.controller.js';

export async function usersRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: [requireAuth] }, usersController.me);
  app.patch('/me', { preHandler: [requireAuth] }, usersController.updateMe);
}
