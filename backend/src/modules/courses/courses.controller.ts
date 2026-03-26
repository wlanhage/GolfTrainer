import { FastifyReply, FastifyRequest } from 'fastify';
import { coursesService } from './courses.service.js';
import {
  courseIdParamSchema,
  createCourseSchema,
  ensureHolesSchema,
  holeParamsSchema,
  listCoursesQuerySchema,
  updateCourseSchema,
  updateHoleLayoutSchema,
  updateHoleMetaSchema
} from './courses.schema.js';

export const coursesController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { search } = listCoursesQuerySchema.parse(request.query ?? {});
    const courses = await coursesService.list(search);
    return reply.send(courses);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = courseIdParamSchema.parse(request.params);
    const course = await coursesService.getById(id);
    return reply.send(course);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = createCourseSchema.parse(request.body);
    const created = await coursesService.create(request.auth!.userId, {
      ...input,
      teeName: input.teeName ?? null
    });
    return reply.code(201).send(created);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = courseIdParamSchema.parse(request.params);
    const input = updateCourseSchema.parse(request.body);
    const course = await coursesService.update(id, input);
    return reply.send(course);
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = courseIdParamSchema.parse(request.params);
    await coursesService.remove(id);
    return reply.code(204).send();
  },

  async ensureHoles(request: FastifyRequest, reply: FastifyReply) {
    const { id } = courseIdParamSchema.parse(request.params);
    const { holeCount } = ensureHolesSchema.parse(request.body);
    const holes = await coursesService.ensureHoles(id, holeCount);
    return reply.send(holes);
  },

  async updateHoleMeta(request: FastifyRequest, reply: FastifyReply) {
    const { id, holeNumber } = holeParamsSchema.parse(request.params);
    const input = updateHoleMetaSchema.parse(request.body);
    const hole = await coursesService.updateHoleMeta(id, holeNumber, input);
    return reply.send(hole);
  },

  async updateHoleLayout(request: FastifyRequest, reply: FastifyReply) {
    const { id, holeNumber } = holeParamsSchema.parse(request.params);
    const { geometry } = updateHoleLayoutSchema.parse(request.body);
    const layout = await coursesService.updateHoleLayout(id, holeNumber, geometry);
    return reply.send(layout);
  }
};
