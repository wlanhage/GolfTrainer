import { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError.js';
import { usersRepository } from '../../modules/users/users.repository.js';

export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.auth?.userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const user = await usersRepository.getById(request.auth.userId);
  if (!user || user.role !== 'ADMIN') {
    throw new ForbiddenError('Admin access required');
  }
}
