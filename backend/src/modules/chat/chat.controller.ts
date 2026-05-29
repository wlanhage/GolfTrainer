import { FastifyReply, FastifyRequest } from 'fastify';
import { recipientIdParamSchema, sendMessageBodySchema, chatPaginationQuerySchema } from './chat.schema.js';
import { chatService } from './chat.service.js';

export const chatController = {
  async listConversations(request: FastifyRequest, reply: FastifyReply) {
    const conversations = await chatService.listConversations(request.auth!.userId);
    return reply.send(conversations);
  },

  async getUnreadCount(request: FastifyRequest, reply: FastifyReply) {
    const count = await chatService.getUnreadCount(request.auth!.userId);
    return reply.send({ count });
  },

  async getMessages(request: FastifyRequest, reply: FastifyReply) {
    const { recipientId } = recipientIdParamSchema.parse(request.params);
    const { limit, before } = chatPaginationQuerySchema.parse(request.query ?? {});
    const messages = await chatService.getConversation(request.auth!.userId, recipientId, limit, before);
    return reply.send(messages);
  },

  async sendMessage(request: FastifyRequest, reply: FastifyReply) {
    const { recipientId } = recipientIdParamSchema.parse(request.params);
    const { content } = sendMessageBodySchema.parse(request.body);
    const message = await chatService.sendMessage(request.auth!.userId, recipientId, content);
    return reply.code(201).send(message);
  },

  async markRead(request: FastifyRequest, reply: FastifyReply) {
    const { recipientId } = recipientIdParamSchema.parse(request.params);
    await chatService.markRead(request.auth!.userId, recipientId);
    return reply.code(204).send();
  }
};
