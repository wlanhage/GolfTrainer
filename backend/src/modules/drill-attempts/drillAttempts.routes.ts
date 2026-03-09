import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { drillAttemptsController } from './drillAttempts.controller.js';

export async function drillAttemptsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', drillAttemptsController.create);
  app.get('/', drillAttemptsController.list);
  app.get('/:attemptId', drillAttemptsController.getById);
  app.patch('/:attemptId', drillAttemptsController.update);
  app.delete('/:attemptId', drillAttemptsController.remove);
}
