import { FastifyReply, FastifyRequest } from 'fastify';
import { usersService } from './users.service.js';
import { updateMeSchema } from './users.schema.js';

export const usersController = {
  async me(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.auth!.userId;
    const me = await usersService.getMe(userId);
    return reply.send(me);
  },

  async updateMe(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.auth!.userId;
    const input = updateMeSchema.parse(request.body);
    const me = await usersService.updateMe(userId, input);
    return reply.send(me);
  }
};
