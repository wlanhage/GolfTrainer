import { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors/AppError.js';
import { jwtService } from '../../infrastructure/jwt/jwt.service.js';

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('Missing bearer token');

  const token = header.slice(7);
  let payload: { sub: string; jti: string; type: string };
  try {
    payload = jwtService.verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError('Invalid access token');
  }

  if (payload.type !== 'access') throw new UnauthorizedError('Invalid token type');
  request.auth = { userId: payload.sub, tokenId: payload.jti };
}
