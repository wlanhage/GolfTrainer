import { FastifyReply, FastifyRequest } from 'fastify';
import { clubsService } from './clubs.service.js';
import { clubIdParamSchema, createClubSchema, updateClubSchema } from './clubs.schema.js';

export const clubsController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = createClubSchema.parse(request.body);
    const userId = request.auth!.userId;
    const club = await clubsService.create(userId, input);
    return reply.code(201).send(club);
  },
  async list(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.auth!.userId;
    const clubs = await clubsService.list(userId);
    return reply.send(clubs);
  },
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clubId } = clubIdParamSchema.parse(request.params);
    const userId = request.auth!.userId;
    const club = await clubsService.getById(userId, clubId);
    return reply.send(club);
  },
  async update(request: FastifyRequest, reply: FastifyReply) {
    const { clubId } = clubIdParamSchema.parse(request.params);
    const input = updateClubSchema.parse(request.body);
    const userId = request.auth!.userId;
    const club = await clubsService.update(userId, clubId, input);
    return reply.send(club);
  },
  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { clubId } = clubIdParamSchema.parse(request.params);
    const userId = request.auth!.userId;
    await clubsService.remove(userId, clubId);
    return reply.code(204).send();
  }
};
