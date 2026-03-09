import { NotFoundError } from '../../common/errors/AppError.js';
import { usersRepository } from './users.repository.js';
import { UpdateMeInput } from './users.schema.js';

export const usersService = {
  async getMe(userId: string) {
    const user = await usersRepository.getMe(userId);
    if (!user) throw new NotFoundError('User not found');

    return {
      id: user.id,
      email: user.email,
      profile: user.profile
    };
  },

  async updateMe(userId: string, input: UpdateMeInput) {
    await usersRepository.upsertProfile(userId, input);
    return this.getMe(userId);
  }
};
