import { NotFoundError } from '../../common/errors/AppError.js';
import { usersRepository } from './users.repository.js';

export const usersService = {
  async getMe(userId: string) {
    const user = await usersRepository.getMe(userId);
    if (!user) throw new NotFoundError('User not found');

    return {
      id: user.id,
      email: user.email,
      profile: user.profile
    };
  }
};
