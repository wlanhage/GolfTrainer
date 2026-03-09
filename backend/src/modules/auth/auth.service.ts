import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ConflictError, UnauthorizedError } from '../../common/errors/AppError.js';
import { env } from '../../config/env.js';
import { jwtService } from '../../infrastructure/jwt/jwt.service.js';
import { passwordService } from '../../infrastructure/password/password.service.js';
import { authRepository } from './auth.repository.js';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const expiresAtFromTtl = (ttl: string) => {
  const parsed = ttl.match(/^(\d+)([smhd])$/);
  if (!parsed) return new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const amount = Number(parsed[1]);
  const unit = parsed[2];
  const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return new Date(Date.now() + amount * mult * 1000);
};

export const authService = {
  async register(input: { email: string; password: string; displayName: string }, meta: { ip?: string; userAgent?: string }) {
    const existing = await authRepository.findUserByEmail(input.email);
    if (existing) throw new ConflictError('Email is already registered');

    const passwordHash = await passwordService.hash(input.password);
    const user = await authRepository.createUser({ ...input, passwordHash });

    return this.issueTokenPair(user.id, meta);
  },

  async login(input: { email: string; password: string }, meta: { ip?: string; userAgent?: string }) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) throw new UnauthorizedError('Invalid credentials');

    const ok = await passwordService.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedError('Invalid credentials');

    return this.issueTokenPair(user.id, meta);
  },

  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
    let payload: { sub: string; jti: string; type: string };
    try {
      payload = jwtService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (payload.type !== 'refresh') throw new UnauthorizedError('Invalid token type');

    const tokenHash = hashToken(refreshToken);
    const activeTokens = await authRepository.findActiveTokensByUser(payload.sub);
    const current = activeTokens.find((t) => t.tokenHash === tokenHash && t.expiresAt > new Date());
    if (!current) throw new UnauthorizedError('Refresh token revoked or expired');

    await authRepository.revokeToken(current.id);
    return this.issueTokenPair(payload.sub, meta);
  },

  async logout(refreshToken: string) {
    try {
      jwtService.verifyRefreshToken(refreshToken);
    } catch {
      return;
    }

    const tokenHash = hashToken(refreshToken);
    const payload = jwt.decode(refreshToken) as { sub?: string } | null;
    if (!payload?.sub) return;

    const activeTokens = await authRepository.findActiveTokensByUser(payload.sub);
    const current = activeTokens.find((t) => t.tokenHash === tokenHash);
    if (current) await authRepository.revokeToken(current.id);
  },

  async issueTokenPair(userId: string, meta: { ip?: string; userAgent?: string }) {
    const { token: accessToken } = jwtService.signAccessToken(userId);
    const { token: refreshToken, tokenId } = jwtService.signRefreshToken(userId);

    await authRepository.saveRefreshToken({
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: expiresAtFromTtl(env.JWT_REFRESH_TTL),
      tokenId,
      ip: meta.ip,
      userAgent: meta.userAgent
    });

    return { accessToken, refreshToken };
  }
};
