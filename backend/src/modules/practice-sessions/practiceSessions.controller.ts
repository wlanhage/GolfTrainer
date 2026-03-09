import { FastifyReply, FastifyRequest } from 'fastify';
import { practiceSessionsService } from './practiceSessions.service.js';
import { createSessionSchema, sessionIdParamSchema, updateSessionSchema } from './practiceSessions.schema.js';

export const practiceSessionsController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = createSessionSchema.parse(request.body);
    const session = await practiceSessionsService.create(request.auth!.userId, input);
    return reply.code(201).send(session);
  },
  async list(request: FastifyRequest, reply: FastifyReply) {
    const sessions = await practiceSessionsService.list(request.auth!.userId);
    return reply.send(sessions);
  },
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { sessionId } = sessionIdParamSchema.parse(request.params);
    const session = await practiceSessionsService.getById(request.auth!.userId, sessionId);
    return reply.send(session);
  },
  async update(request: FastifyRequest, reply: FastifyReply) {
    const { sessionId } = sessionIdParamSchema.parse(request.params);
    const input = updateSessionSchema.parse(request.body);
    const session = await practiceSessionsService.update(request.auth!.userId, sessionId, input);
    return reply.send(session);
  },
  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { sessionId } = sessionIdParamSchema.parse(request.params);
    await practiceSessionsService.remove(request.auth!.userId, sessionId);
    return reply.code(204).send();
  }
};
