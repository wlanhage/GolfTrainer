import { NotFoundError } from '../../common/errors/AppError.js';
import { usersRepository } from './users.repository.js';
import { AdminUpdateUserInput, UpdateMeInput } from './users.schema.js';

const toUserView = (user: Awaited<ReturnType<typeof usersRepository.getMe>>) => ({
  id: user!.id,
  email: user!.email,
  role: user!.role,
  isActive: user!.isActive,
  profile: user!.profile
});

export const usersService = {
  async getMe(userId: string) {
    const user = await usersRepository.getMe(userId);
    if (!user) throw new NotFoundError('User not found');

    return toUserView(user);
  },

  async updateMe(userId: string, input: UpdateMeInput) {
    await usersRepository.upsertProfile(userId, input);
    return this.getMe(userId);
  },

  async listAll() {
    const users = await usersRepository.listAllUsers();
    return users.map((user) => toUserView(user));
  },

  async updateByAdmin(userId: string, input: AdminUpdateUserInput) {
    const user = await usersRepository.updateUserById(userId, input);
    if (!user) throw new NotFoundError('User not found');
    return toUserView(user);
  }
};
