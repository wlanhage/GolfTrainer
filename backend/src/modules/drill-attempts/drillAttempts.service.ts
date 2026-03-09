import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { drillAttemptsRepository } from './drillAttempts.repository.js';

export const drillAttemptsService = {
  async create(
    userId: string,
    input: { drillId: string; practiceSessionId?: string; successfulAttempts: number; totalAttempts: number; score?: number; notes?: string; attemptedAt?: Date }
  ) {
    const drill = await drillAttemptsRepository.userOwnsDrill(userId, input.drillId);
    if (!drill) throw new NotFoundError('Drill not found');

    if (input.practiceSessionId) {
      const session = await drillAttemptsRepository.userOwnsSession(userId, input.practiceSessionId);
      if (!session) throw new NotFoundError('Practice session not found');
    }

    return drillAttemptsRepository.create(userId, {
      drillId: input.drillId,
      practiceSessionId: input.practiceSessionId,
      successCount: input.successfulAttempts,
      attemptCount: input.totalAttempts,
      score: input.score,
      notes: input.notes,
      attemptedAt: input.attemptedAt
    });
  },
  list(userId: string) {
    return drillAttemptsRepository.list(userId);
  },
  async getById(userId: string, id: string) {
    const attempt = await drillAttemptsRepository.getById(userId, id);
    if (!attempt) throw new NotFoundError('Drill attempt not found');
    return attempt;
  },
  async update(
    userId: string,
    id: string,
    input: { successfulAttempts?: number; totalAttempts?: number; score?: number | null; notes?: string; attemptedAt?: Date }
  ) {
    const existing = await this.getById(userId, id);
    const effectiveSuccess = input.successfulAttempts ?? existing.successCount;
    const effectiveTotal = input.totalAttempts ?? existing.attemptCount;
    if (effectiveSuccess > effectiveTotal) {
      throw new BadRequestError('successfulAttempts must be <= totalAttempts');
    }

    const data: Record<string, unknown> = {
      successCount: input.successfulAttempts,
      attemptCount: input.totalAttempts,
      score: input.score,
      notes: input.notes,
      attemptedAt: input.attemptedAt
    };

    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);

    const res = await drillAttemptsRepository.update(userId, id, data);
    if (res.count === 0) throw new NotFoundError('Drill attempt not found');
    return this.getById(userId, id);
  },
  async remove(userId: string, id: string) {
    const res = await drillAttemptsRepository.delete(userId, id);
    if (res.count === 0) throw new NotFoundError('Drill attempt not found');
  }
};
