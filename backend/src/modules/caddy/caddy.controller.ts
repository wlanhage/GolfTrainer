import { FastifyReply, FastifyRequest } from 'fastify';
import { caddyService } from './caddy.service.js';
import {
  caddyClubParamsSchema,
  caddyShotIdParamsSchema,
  caddyTargetQuerySchema,
  createCaddyShotSchema
} from './caddy.schema.js';

export const caddyController = {
  async listClubSummaries(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = caddyTargetQuerySchema.parse(request.query);
    const items = await caddyService.listClubSummaries(request.auth!.userId, userId);
    return reply.send({ items });
  },

  async listClubShots(request: FastifyRequest, reply: FastifyReply) {
    const { clubKey } = caddyClubParamsSchema.parse(request.params);
    const { userId } = caddyTargetQuerySchema.parse(request.query);
    const shots = await caddyService.listShotsForClub(request.auth!.userId, clubKey, userId);
    return reply.send({ shots });
  },

  async createShot(request: FastifyRequest, reply: FastifyReply) {
    const { clubKey } = caddyClubParamsSchema.parse(request.params);
    const input = createCaddyShotSchema.parse(request.body);
    const shot = await caddyService.addShot(request.auth!.userId, clubKey, input);
    return reply.code(201).send(shot);
  },

  async removeShot(request: FastifyRequest, reply: FastifyReply) {
    const { shotId } = caddyShotIdParamsSchema.parse(request.params);
    await caddyService.removeShot(request.auth!.userId, shotId);
    return reply.code(204).send();
  }
};
