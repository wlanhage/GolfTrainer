import { FastifyReply, FastifyRequest } from 'fastify';
import { drillsService } from './drills.service.js';
import { adminCreateDrillSchema, createDrillSchema, drillIdParamSchema, updateDrillSchema } from './drills.schema.js';

export const drillsController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = createDrillSchema.parse(request.body);
    const drill = await drillsService.create(request.auth!.userId, input);
    return reply.code(201).send(drill);
  },
  async list(request: FastifyRequest, reply: FastifyReply) {
    const drills = await drillsService.listVisible(request.auth!.userId);
    return reply.send(drills);
  },
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { drillId } = drillIdParamSchema.parse(request.params);
    const drill = await drillsService.getVisibleById(request.auth!.userId, drillId);
    return reply.send(drill);
  },
  async update(request: FastifyRequest, reply: FastifyReply) {
    const { drillId } = drillIdParamSchema.parse(request.params);
    const input = updateDrillSchema.parse(request.body);
    const drill = await drillsService.updateOwned(request.auth!.userId, drillId, input);
    return reply.send(drill);
  },
  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { drillId } = drillIdParamSchema.parse(request.params);
    await drillsService.removeOwned(request.auth!.userId, drillId);
    return reply.code(204).send();
  },

  async adminList(_request: FastifyRequest, reply: FastifyReply) {
    const drills = await drillsService.listAll();
    return reply.send(drills);
  },
  async adminCreate(request: FastifyRequest, reply: FastifyReply) {
    const input = adminCreateDrillSchema.parse(request.body);
    const drill = await drillsService.createByAdmin(input);
    return reply.code(201).send(drill);
  },
  async adminUpdate(request: FastifyRequest, reply: FastifyReply) {
    const { drillId } = drillIdParamSchema.parse(request.params);
    const input = updateDrillSchema.parse(request.body);
    const drill = await drillsService.updateByAdmin(drillId, input);
    return reply.send(drill);
  },
  async adminRemove(request: FastifyRequest, reply: FastifyReply) {
    const { drillId } = drillIdParamSchema.parse(request.params);
    await drillsService.removeByAdmin(drillId);
    return reply.code(204).send();
  }
};
