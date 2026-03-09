import { NotFoundError } from '../../common/errors/AppError.js';
import { drillsRepository } from './drills.repository.js';

export const drillsService = {
  create(userId: string, input: { name: string; description?: string; metricType: 'SUCCESS_RATE' | 'DISTANCE_CONTROL' | 'DISPERSION' | 'STROKES' | 'TIME_BASED'; isPublic?: boolean }) {
    return drillsRepository.create(userId, input);
  },
  listVisible(userId: string) {
    return drillsRepository.listVisible(userId);
  },
  async getVisibleById(userId: string, id: string) {
    const drill = await drillsRepository.getVisibleById(userId, id);
    if (!drill) throw new NotFoundError('Drill not found');
    return drill;
  },
  async updateOwned(userId: string, id: string, input: Record<string, unknown>) {
    const res = await drillsRepository.updateOwned(userId, id, input);
    if (res.count === 0) throw new NotFoundError('Drill not found');
    return this.getVisibleById(userId, id);
  },
  async removeOwned(userId: string, id: string) {
    const res = await drillsRepository.deleteOwned(userId, id);
    if (res.count === 0) throw new NotFoundError('Drill not found');
  }
};
