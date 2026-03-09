import { prisma } from '../../infrastructure/prisma/client.js';

export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  createUser(data: { email: string; passwordHash: string; displayName: string }) {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        profile: { create: { displayName: data.displayName } }
      }
    });
  },
  async saveRefreshToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    tokenId: string;
    ip?: string;
    userAgent?: string;
  }) {
    return prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tokenId: input.tokenId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        ip: input.ip,
        userAgent: input.userAgent
      }
    });
  },
  findActiveTokensByUser(userId: string) {
    return prisma.refreshToken.findMany({
      where: { userId, revokedAt: null }
    });
  },
  revokeToken(id: string, reason = 'ROTATED_OR_LOGOUT') {
    return prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date(), revokedReason: reason } });
  }
};
