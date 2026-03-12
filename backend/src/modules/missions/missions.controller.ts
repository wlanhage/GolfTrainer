import { FastifyReply, FastifyRequest } from 'fastify';
import { missionIdParamSchema, adminCreateMissionSchema, adminUpdateMissionSchema } from './missions.schema.js';
import { missionsService } from './missions.service.js';

export const missionsController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const missions = await missionsService.listForTrainingNavigation();
    return reply.send(missions);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { missionId } = missionIdParamSchema.parse(request.params);
    const mission = await missionsService.getById(missionId);
    return reply.send(mission);
  },

  async adminList(_request: FastifyRequest, reply: FastifyReply) {
    const missions = await missionsService.listAllForAdmin();
    return reply.send(missions);
  },

  async adminCreate(request: FastifyRequest, reply: FastifyReply) {
    const input = adminCreateMissionSchema.parse(request.body);
    const mission = await missionsService.createByAdmin(request.auth!.userId, input);
    return reply.code(201).send(mission);
  },

  async adminUpdate(request: FastifyRequest, reply: FastifyReply) {
    const { missionId } = missionIdParamSchema.parse(request.params);
    const input = adminUpdateMissionSchema.parse(request.body);
    const mission = await missionsService.updateByAdmin(missionId, input);
    return reply.send(mission);
  },

  async adminRemove(request: FastifyRequest, reply: FastifyReply) {
    const { missionId } = missionIdParamSchema.parse(request.params);
    await missionsService.removeByAdmin(missionId);
    return reply.code(204).send();
  }
};
