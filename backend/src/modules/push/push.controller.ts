import { FastifyReply, FastifyRequest } from 'fastify';
import { subscribeBodySchema, unsubscribeBodySchema } from './push.schema.js';
import { pushService } from './push.service.js';

export const pushController = {
  async getVapidPublicKey(_request: FastifyRequest, reply: FastifyReply) {
    const publicKey = pushService.getVapidPublicKey();
    return reply.send({ publicKey });
  },

  async subscribe(request: FastifyRequest, reply: FastifyReply) {
    const { endpoint, keys } = subscribeBodySchema.parse(request.body);
    const userId = request.auth!.userId;
    const userAgent = request.headers['user-agent'] ?? null;
    await pushService.subscribe(userId, endpoint, keys.p256dh, keys.auth, userAgent);
    return reply.code(201).send({ ok: true });
  },

  async unsubscribe(request: FastifyRequest, reply: FastifyReply) {
    const { endpoint } = unsubscribeBodySchema.parse(request.body);
    const userId = request.auth!.userId;
    await pushService.unsubscribe(userId, endpoint);
    return reply.code(204).send();
  }
};
