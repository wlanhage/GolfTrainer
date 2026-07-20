import { FastifyReply, FastifyRequest } from 'fastify';
import { inviteCodeParamSchema, joinAsGuestSchema } from './join.schema.js';
import { joinService } from './join.service.js';

export const joinController = {
  async createInvite(request: FastifyRequest, reply: FastifyReply) {
    const invite = await joinService.createInvite(request.auth!.userId);
    return reply.code(201).send(invite);
  },

  async getInviteInfo(request: FastifyRequest, reply: FastifyReply) {
    const { code } = inviteCodeParamSchema.parse(request.params);
    const info = await joinService.getInviteInfo(code);
    return reply.send(info);
  },

  async joinAsUser(request: FastifyRequest, reply: FastifyReply) {
    const { code } = inviteCodeParamSchema.parse(request.params);
    const result = await joinService.joinAsUser(code, request.auth!.userId);
    return reply.send(result);
  },

  async joinAsGuest(request: FastifyRequest, reply: FastifyReply) {
    const { code } = inviteCodeParamSchema.parse(request.params);
    const { name } = joinAsGuestSchema.parse(request.body);
    const result = await joinService.joinAsGuest(code, name, {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
    return reply.send(result);
  }
};
