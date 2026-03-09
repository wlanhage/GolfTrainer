import { FastifyReply, FastifyRequest } from 'fastify';
import { statsService } from './stats.service.js';
import { rangeQuerySchema, trendQuerySchema } from './stats.schema.js';

export const statsController = {
  async averageCarryPerClub(request: FastifyRequest, reply: FastifyReply) {
    const { rangeDays } = rangeQuerySchema.parse(request.query);
    const data = await statsService.averageCarryPerClub(request.auth!.userId, rangeDays);
    return reply.send({ rangeDays, items: data });
  },

  async successRatePerDrill(request: FastifyRequest, reply: FastifyReply) {
    const { rangeDays } = rangeQuerySchema.parse(request.query);
    const data = await statsService.successRatePerDrill(request.auth!.userId, rangeDays);
    return reply.send({ rangeDays, items: data });
  },

  async trend(request: FastifyRequest, reply: FastifyReply) {
    const { rangeDays } = trendQuerySchema.parse(request.query);
    const points = await statsService.trendLastDays(request.auth!.userId, rangeDays);
    return reply.send({ rangeDays, points });
  },

  async overview(request: FastifyRequest, reply: FastifyReply) {
    const { rangeDays } = rangeQuerySchema.parse(request.query);
    const overview = await statsService.dashboardOverview(request.auth!.userId, rangeDays);
    return reply.send(overview);
  }
};
