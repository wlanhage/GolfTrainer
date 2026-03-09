import { NotFoundError } from '../../common/errors/AppError.js';
import { practiceSessionsRepository } from './practiceSessions.repository.js';

export const practiceSessionsService = {
  create(userId: string, input: { title?: string; focusArea?: string; notes?: string; startedAt: Date; endedAt?: Date }) {
    return practiceSessionsRepository.create(userId, input);
  },
  list(userId: string) {
    return practiceSessionsRepository.list(userId);
  },
  async getById(userId: string, id: string) {
    const session = await practiceSessionsRepository.getById(userId, id);
    if (!session) throw new NotFoundError('Session not found');
    return session;
  },
  async update(userId: string, id: string, input: Record<string, unknown>) {
    const res = await practiceSessionsRepository.update(userId, id, input);
    if (res.count === 0) throw new NotFoundError('Session not found');
    return this.getById(userId, id);
  },
  async remove(userId: string, id: string) {
    const res = await practiceSessionsRepository.delete(userId, id);
    if (res.count === 0) throw new NotFoundError('Session not found');
  }
};
