import { FastifyReply, FastifyRequest } from 'fastify';
import { authService } from './auth.service.js';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from './auth.schema.js';
import { pairingService } from './pairing.service.js';
import { pairClaimSchema, pairPollSchema } from './pairing.schema.js';

export const authController = {
  // ─── Apple Watch pairing (device-code flow) ────────────────────────────────

  async pairStart(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await pairingService.start());
  },

  async pairPoll(request: FastifyRequest, reply: FastifyReply) {
    const { deviceSecret } = pairPollSchema.parse(request.body);
    const result = await pairingService.poll(deviceSecret, {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
    return reply.send(result);
  },

  async pairClaim(request: FastifyRequest, reply: FastifyReply) {
    const { code } = pairClaimSchema.parse(request.body);
    return reply.send(await pairingService.claim(request.auth!.userId, code));
  },

  async register(request: FastifyRequest, reply: FastifyReply) {
    const input = registerSchema.parse(request.body);
    const result = await authService.register(input, {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
    return reply.code(201).send(result);
  },

  async login(request: FastifyRequest, reply: FastifyReply) {
    const input = loginSchema.parse(request.body);
    const result = await authService.login(input, {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
    return reply.send(result);
  },

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = refreshSchema.parse(request.body);
    const result = await authService.refresh(refreshToken, {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
    return reply.send(result);
  },

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = logoutSchema.parse(request.body);
    await authService.logout(refreshToken);
    return reply.code(204).send();
  }
};
