import { FastifyReply, FastifyRequest } from 'fastify';
import { drillAttemptsService } from './drillAttempts.service.js';
import { attemptIdParamSchema, createDrillAttemptSchema, updateDrillAttemptSchema } from './drillAttempts.schema.js';

export const drillAttemptsController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = createDrillAttemptSchema.parse(request.body);
    const attempt = await drillAttemptsService.create(request.auth!.userId, input);
    return reply.code(201).send(attempt);
  },
  async list(request: FastifyRequest, reply: FastifyReply) {
    const attempts = await drillAttemptsService.list(request.auth!.userId);
    return reply.send(attempts);
  },
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { attemptId } = attemptIdParamSchema.parse(request.params);
    const attempt = await drillAttemptsService.getById(request.auth!.userId, attemptId);
    return reply.send(attempt);
  },
  async update(request: FastifyRequest, reply: FastifyReply) {
    const { attemptId } = attemptIdParamSchema.parse(request.params);
    const input = updateDrillAttemptSchema.parse(request.body);
    const attempt = await drillAttemptsService.update(request.auth!.userId, attemptId, input);
    return reply.send(attempt);
  },
  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { attemptId } = attemptIdParamSchema.parse(request.params);
    await drillAttemptsService.remove(request.auth!.userId, attemptId);
    return reply.code(204).send();
  }
};
