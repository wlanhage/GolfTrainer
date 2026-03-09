import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';

export type AccessTokenPayload = { sub: string; jti: string; type: 'access' };
export type RefreshTokenPayload = { sub: string; jti: string; type: 'refresh' };

export const jwtService = {
  signAccessToken(userId: string) {
    const payload: AccessTokenPayload = { sub: userId, jti: randomUUID(), type: 'access' };
    const token = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL });
    return { token, tokenId: payload.jti };
  },
  signRefreshToken(userId: string) {
    const payload: RefreshTokenPayload = { sub: userId, jti: randomUUID(), type: 'refresh' };
    const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_TTL });
    return { token, tokenId: payload.jti };
  },
  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  },
  verifyRefreshToken(token: string): RefreshTokenPayload {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  }
};
