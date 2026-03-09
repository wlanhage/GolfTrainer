import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { practiceSessionsController } from './practiceSessions.controller.js';

export async function practiceSessionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/', practiceSessionsController.create);
  app.get('/', practiceSessionsController.list);
  app.get('/:sessionId', practiceSessionsController.getById);
  app.patch('/:sessionId', practiceSessionsController.update);
  app.delete('/:sessionId', practiceSessionsController.remove);
}
