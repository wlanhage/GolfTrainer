import { FastifyReply, FastifyRequest } from 'fastify';
import { caddyChatSchema, clubRecommendSchema } from './ai.schema.js';
import { aiService } from './ai.service.js';

export const aiController = {
  async caddyChat(request: FastifyRequest, reply: FastifyReply) {
    const input = caddyChatSchema.parse(request.body);
    const response = await aiService.caddyChat(request.auth!.userId, input.message, input.roundId);
    return reply.send({ response });
  },

  async recommendClub(request: FastifyRequest, reply: FastifyReply) {
    const input = clubRecommendSchema.parse(request.body);
    const response = await aiService.recommendClub(request.auth!.userId, input);
    return reply.send({ response });
  },
};
