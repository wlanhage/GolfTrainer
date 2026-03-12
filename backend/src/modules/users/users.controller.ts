import { FastifyReply, FastifyRequest } from 'fastify';
import { usersService } from './users.service.js';
import { adminUpdateUserSchema, updateMeSchema, userIdParamSchema } from './users.schema.js';

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
  },

  async adminList(request: FastifyRequest, reply: FastifyReply) {
    const users = await usersService.listAll();
    return reply.send(users);
  },

  async adminUpdateById(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = userIdParamSchema.parse(request.params);
    const input = adminUpdateUserSchema.parse(request.body);
    const user = await usersService.updateByAdmin(userId, input);
    return reply.send(user);
  }
};
