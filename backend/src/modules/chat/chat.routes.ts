import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { chatController } from './chat.controller.js';

export async function chatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/conversations', chatController.listConversations);
  app.get('/unread-count', chatController.getUnreadCount);
  app.get('/:recipientId/messages', chatController.getMessages);
  app.post('/:recipientId/messages', chatController.sendMessage);
  app.post('/:recipientId/read', chatController.markRead);
}
