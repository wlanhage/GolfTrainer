import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';

export type AccessTokenPayload = { sub: string; jti: string; type: 'access' };
export type RefreshTokenPayload = { sub: string; jti: string; type: 'refresh' };

export const jwtService = {
  signAccessToken(userId: string) {
    const payload: AccessTokenPayload = { sub: userId, jti: randomUUID(), type: 'access' };
    const secret: Secret = env.JWT_ACCESS_SECRET;
    const expiresIn: SignOptions['expiresIn'] = env.JWT_ACCESS_TTL as SignOptions['expiresIn'];
    const token = jwt.sign(payload, secret, { expiresIn });
    return { token, tokenId: payload.jti };
  },
  signRefreshToken(userId: string) {
    const payload: RefreshTokenPayload = { sub: userId, jti: randomUUID(), type: 'refresh' };
    const secret: Secret = env.JWT_REFRESH_SECRET;
    const expiresIn: SignOptions['expiresIn'] = env.JWT_REFRESH_TTL as SignOptions['expiresIn'];
    const token = jwt.sign(payload, secret, { expiresIn });
    return { token, tokenId: payload.jti };
  },
  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  },
  verifyRefreshToken(token: string): RefreshTokenPayload {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  }
};
