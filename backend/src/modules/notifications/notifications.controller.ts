import { FastifyReply, FastifyRequest } from 'fastify';
import { listNotificationsQuerySchema, notificationIdParamSchema } from './notifications.schema.js';
import { notificationsService } from './notifications.service.js';

export const notificationsController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listNotificationsQuerySchema.parse(request.query ?? {});
    const items = await notificationsService.list(request.auth!.userId, query);
    return reply.send(items);
  },

  async unreadCount(request: FastifyRequest, reply: FastifyReply) {
    const result = await notificationsService.unreadCount(request.auth!.userId);
    return reply.send(result);
  },

  async markRead(request: FastifyRequest, reply: FastifyReply) {
    const { notificationId } = notificationIdParamSchema.parse(request.params);
    await notificationsService.markRead(notificationId, request.auth!.userId);
    return reply.code(204).send();
  },

  async markAllRead(request: FastifyRequest, reply: FastifyReply) {
    await notificationsService.markAllRead(request.auth!.userId);
    return reply.code(204).send();
  }
};
