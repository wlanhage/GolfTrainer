import { NotFoundError } from '../../common/errors/AppError.js';
import { clubsRepository } from './clubs.repository.js';

export const clubsService = {
  create(userId: string, input: { clubCatalogId?: string; label: string; isActive?: boolean }) {
    return clubsRepository.create(userId, input);
  },
  list(userId: string) {
    return clubsRepository.list(userId);
  },
  async getById(userId: string, id: string) {
    const club = await clubsRepository.getById(userId, id);
    if (!club) throw new NotFoundError('Club not found');
    return club;
  },
  async update(userId: string, id: string, input: { clubCatalogId?: string; label?: string; isActive?: boolean }) {
    const res = await clubsRepository.update(userId, id, input);
    if (res.count === 0) throw new NotFoundError('Club not found');
    return this.getById(userId, id);
  },
  async remove(userId: string, id: string) {
    const res = await clubsRepository.delete(userId, id);
    if (res.count === 0) throw new NotFoundError('Club not found');
  }
};
