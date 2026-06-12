import { prisma } from '../../infrastructure/prisma/client.js';

export const pairingRepository = {
  create(data: { code: string; deviceHash: string; expiresAt: Date }) {
    return prisma.watchPairing.create({ data });
  },
  findByDeviceHash(deviceHash: string) {
    return prisma.watchPairing.findUnique({ where: { deviceHash } });
  },
  findByCode(code: string) {
    return prisma.watchPairing.findUnique({ where: { code } });
  },
  codeExists(code: string) {
    return prisma.watchPairing.findUnique({ where: { code }, select: { id: true } });
  },
  approve(id: string, userId: string) {
    return prisma.watchPairing.update({
      where: { id },
      data: { userId, status: 'APPROVED', claimedAt: new Date() }
    });
  },
  consume(id: string) {
    return prisma.watchPairing.update({ where: { id }, data: { status: 'CONSUMED' } });
  }
};
