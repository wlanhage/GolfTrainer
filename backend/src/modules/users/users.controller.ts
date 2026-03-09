import { FastifyReply, FastifyRequest } from 'fastify';
import { usersService } from './users.service.js';

export const usersController = {
  async me(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.auth!.userId;
    const me = await usersService.getMe(userId);
    return reply.send(me);
  }
};
