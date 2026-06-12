import { FastifyReply, FastifyRequest } from 'fastify';
import { readFileSync } from 'node:fs';
import {
  createRoundSchema,
  createRoundShotSchema,
  holeIdParamSchema,
  listRoundsQuerySchema,
  playerScoreParamSchema,
  roundHoleParamSchema,
  roundIdParamSchema,
  roundShotIdParamSchema,
  setRoundImageSchema,
  updatePlayerScoreSchema,
  updateRoundHoleSchema,
  updateRoundSchema,
  updateStrokesSchema
} from './rounds.schema.js';
import { roundsService } from './rounds.service.js';
import { greenImages } from './greenImages.js';

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

  async adminList(request: FastifyRequest, reply: FastifyReply) {
    const query = listRoundsQuerySchema.parse(request.query ?? {});
    const rounds = await roundsService.adminListAll(query);
    return reply.send({ rounds });
  },

  async adminStats(_request: FastifyRequest, reply: FastifyReply) {
    const stats = await roundsService.adminStats();
    return reply.send(stats);
  },

  async adminRecomputeTotalScore(request: FastifyRequest, reply: FastifyReply) {
    const { roundId } = roundIdParamSchema.parse(request.params);
    const result = await roundsService.adminRecomputeTotalScore(roundId);
    return reply.send(result);
  },

  // ─── Watch companion ───────────────────────────────────────────────────────

  async getActive(request: FastifyRequest, reply: FastifyReply) {
    const active = await roundsService.getActiveRound(request.auth!.userId);
    return reply.send(active);
  },

  async greenImage(request: FastifyRequest, reply: FastifyReply) {
    const { holeId } = holeIdParamSchema.parse(request.params);
    const path = greenImages.filePath(holeId);
    if (!path) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'No green image' } });
    return reply.type('image/png').header('Cache-Control', 'public, max-age=86400').send(readFileSync(path));
  },

  async nextHole(request: FastifyRequest, reply: FastifyReply) {
    const { roundId } = roundIdParamSchema.parse(request.params);
    const result = await roundsService.advanceToNextHole(roundId, request.auth!.userId);
    return reply.send(result);
  },

  async updateStrokes(request: FastifyRequest, reply: FastifyReply) {
    const { roundId, holeNumber } = roundHoleParamSchema.parse(request.params);
    const { strokes } = updateStrokesSchema.parse(request.body);
    const score = await roundsService.updateMyStrokes(roundId, request.auth!.userId, holeNumber, strokes);
    return reply.send(score);
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
  },

  async createShot(request: FastifyRequest, reply: FastifyReply) {
    const { roundId } = roundIdParamSchema.parse(request.params);
    const input = createRoundShotSchema.parse(request.body);
    const shot = await roundsService.createRoundShot(roundId, request.auth!.userId, input);
    return reply.code(201).send(shot);
  },

  async listShots(request: FastifyRequest, reply: FastifyReply) {
    const { roundId } = roundIdParamSchema.parse(request.params);
    const shots = await roundsService.getRoundShots(roundId, request.auth!.userId);
    return reply.send(shots);
  },

  async deleteShot(request: FastifyRequest, reply: FastifyReply) {
    const { roundId, shotId } = roundShotIdParamSchema.parse(request.params);
    await roundsService.deleteRoundShot(roundId, request.auth!.userId, shotId);
    return reply.code(204).send();
  }
};
