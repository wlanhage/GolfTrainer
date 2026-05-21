import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { notificationsController } from './notifications.controller.js';

export async function notificationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/', notificationsController.list);
  app.get('/unread-count', notificationsController.unreadCount);
  app.post('/:notificationId/read', notificationsController.markRead);
  app.post('/read-all', notificationsController.markAllRead);
}
