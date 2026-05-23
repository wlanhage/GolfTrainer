import { FastifyReply, FastifyRequest } from 'fastify';
import {
  createRoundSchema,
  listRoundsQuerySchema,
  playerScoreParamSchema,
  roundHoleParamSchema,
  roundIdParamSchema,
  setRoundImageSchema,
  updatePlayerScoreSchema,
  updateRoundHoleSchema,
  updateRoundSchema
} from './rounds.schema.js';
import { roundsService } from './rounds.service.js';

export const roundsController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = createRoundSchema.parse(request.body);
    const round = await roundsService.createRound(request.auth!.userId, input);
    return reply.code(201).send(round);
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listRoundsQuerySchema.parse(request.query ?? {});
    const rounds = await roundsService.listForUser(request.auth!.userId, query);
    return reply.send(rounds);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { roundId } = roundIdParamSchema.parse(request.params);
    const round = await roundsService.getById(roundId, request.auth!.userId);
    return reply.send(round);
  },

  async getByIdPublic(request: FastifyRequest, reply: FastifyReply) {
    const { roundId } = roundIdParamSchema.parse(request.params);
    const round = await roundsService.getByIdPublic(roundId);
    return reply.send(round);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { roundId } = roundIdParamSchema.parse(request.params);
    const input = updateRoundSchema.parse(request.body);
    const round = await roundsService.updateRound(roundId, request.auth!.userId, input);
    return reply.send(round);
  },

  async updateHole(request: FastifyRequest, reply: FastifyReply) {
    const { roundId, holeNumber } = roundHoleParamSchema.parse(request.params);
    const input = updateRoundHoleSchema.parse(request.body);
    const hole = await roundsService.updateRoundHole(roundId, request.auth!.userId, holeNumber, input);
    return reply.send(hole);
  },

  async updatePlayerScore(request: FastifyRequest, reply: FastifyReply) {
    const { roundId, holeNumber, playerId } = playerScoreParamSchema.parse(request.params);
    const input = updatePlayerScoreSchema.parse(request.body);
    const score = await roundsService.updatePlayerScore(roundId, request.auth!.userId, holeNumber, playerId, input);
    return reply.send(score);
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { roundId } = roundIdParamSchema.parse(request.params);
    await roundsService.deleteRound(roundId, request.auth!.userId);
    return reply.code(204).send();
  },

  async setImage(request: FastifyRequest, reply: FastifyReply) {
    const { roundId } = roundIdParamSchema.parse(request.params);
    const { image } = setRoundImageSchema.parse(request.body);
    const round = await roundsService.setRoundImage(roundId, request.auth!.userId, image);
    return reply.send(round);
  },

  async leave(request: FastifyRequest, reply: FastifyReply) {
    const { roundId } = roundIdParamSchema.parse(request.params);
    await roundsService.leaveRound(roundId, request.auth!.userId);
    return reply.code(204).send();
  }
};
