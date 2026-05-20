import { prisma } from '../../infrastructure/prisma/client.js';
import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { roundsRepository } from './rounds.repository.js';
import { pushService } from '../push/push.service.js';
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

    // Notify the user on a personal best — fire-and-forget, non-blocking
    if (input.status === 'COMPLETED' && updated.totalScore !== null) {
      roundsService
        .checkAndNotifyPersonalBest(userId, roundId, updated.totalScore, updated.courseNameSnapshot)
        .catch(() => undefined);
    }

    return updated;
  },

  async checkAndNotifyPersonalBest(
    userId: string,
    currentRoundId: string,
    currentScore: number,
    courseNameSnapshot: string
  ) {
    // Find best score among all other completed rounds for this user
    const previousBest = await prisma.round.findFirst({
      where: {
        userId,
        status: 'COMPLETED',
        totalScore: { not: null },
        id: { not: currentRoundId }
      },
      orderBy: { totalScore: 'asc' },
      select: { totalScore: true }
    });

    const isPersonalBest = previousBest === null || currentScore < previousBest.totalScore!;

    if (isPersonalBest) {
      const sign = currentScore > 0 ? `+${currentScore}` : String(currentScore);
      await pushService.sendPushToUser(userId, {
        title: 'Personligt rekord!',
        body: `Du slog ditt rekord på ${courseNameSnapshot}: ${sign}`,
        url: '/play'
      });
    }
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
