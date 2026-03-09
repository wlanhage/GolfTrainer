import { FastifyReply, FastifyRequest } from 'fastify';
import { shotsService } from './shots.service.js';
import { createShotSchema, shotIdParamSchema, updateShotSchema } from './shots.schema.js';

export const shotsController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = createShotSchema.parse(request.body);
    const shot = await shotsService.create(request.auth!.userId, input);
    return reply.code(201).send(shot);
  },
  async list(request: FastifyRequest, reply: FastifyReply) {
    const shots = await shotsService.list(request.auth!.userId);
    return reply.send(shots);
  },
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { shotId } = shotIdParamSchema.parse(request.params);
    const shot = await shotsService.getById(request.auth!.userId, shotId);
    return reply.send(shot);
  },
  async update(request: FastifyRequest, reply: FastifyReply) {
    const { shotId } = shotIdParamSchema.parse(request.params);
    const input = updateShotSchema.parse(request.body);
    const shot = await shotsService.update(request.auth!.userId, shotId, input);
    return reply.send(shot);
  },
  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { shotId } = shotIdParamSchema.parse(request.params);
    await shotsService.remove(request.auth!.userId, shotId);
    return reply.code(204).send();
  }
};
