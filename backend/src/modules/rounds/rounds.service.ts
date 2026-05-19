import { prisma } from '../../infrastructure/prisma/client.js';
import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { roundsRepository } from './rounds.repository.js';
import type { ListRoundsQuery, UpdateRoundHoleInput, UpdateRoundInput } from './rounds.schema.js';

export const roundsService = {
  async createRound(userId: string, courseId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { holes: { orderBy: { holeNumber: 'asc' } } }
    });
    if (!course) throw new NotFoundError('Course not found');
    if (course.holes.length === 0) {
      throw new BadRequestError('Course has no holes — create holes first.');
    }

    return roundsRepository.createRound({
      userId,
      courseId,
      courseNameSnapshot: course.courseName,
      clubNameSnapshot: course.clubName,
      teeNameSnapshot: course.teeName ?? null,
      holes: course.holes.map((h) => ({
        holeId: h.id,
        holeNumber: h.holeNumber,
        par: h.par,
        length: h.length,
        hcpIndex: h.hcpIndex
      }))
    });
  },

  listForUser(userId: string, query: ListRoundsQuery) {
    return roundsRepository.listForUser(userId, { status: query.status, limit: query.limit, offset: query.offset });
  },

  async getById(roundId: string, userId: string) {
    const round = await roundsRepository.getByIdForUser(roundId, userId);
    if (!round) throw new NotFoundError('Round not found');
    return round;
  },

  async updateRound(roundId: string, userId: string, input: UpdateRoundInput) {
    const patch: Parameters<typeof roundsRepository.updateRound>[2] = { ...input };
    if (input.status === 'COMPLETED' || input.status === 'ABANDONED') {
      patch.finishedAt = new Date();
      patch.totalScore = await roundsRepository.computeTotalScore(roundId);
    }
    const updated = await roundsRepository.updateRound(roundId, userId, patch);
    if (!updated) throw new NotFoundError('Round not found');
    return updated;
  },

  async updateRoundHole(roundId: string, userId: string, holeNumber: number, input: UpdateRoundHoleInput) {
    const updated = await roundsRepository.updateRoundHole(roundId, userId, holeNumber, input);
    if (!updated) throw new NotFoundError('Round hole not found');
    return updated;
  },

  async deleteRound(roundId: string, userId: string) {
    const ok = await roundsRepository.deleteRound(roundId, userId);
    if (!ok) throw new NotFoundError('Round not found');
  }
};
