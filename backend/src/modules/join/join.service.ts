import crypto from 'node:crypto';
import { prisma } from '../../infrastructure/prisma/client.js';
import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { passwordService } from '../../infrastructure/password/password.service.js';
import { authService } from '../auth/auth.service.js';

// En invite utan runda gäller tills hosten startar sin nästa runda, men max
// så här länge — äldre koder betraktas som förbrukade.
export const INVITE_TTL_MS = 1000 * 60 * 60 * 24;

const getDisplayName = async (userId: string): Promise<string> => {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { displayName: true }
  });
  if (profile) return profile.displayName;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return u?.email ?? 'Spelare';
};

const getJoinableInvite = async (code: string) => {
  const invite = await prisma.roundInvite.findUnique({
    where: { code },
    include: {
      round: {
        select: { id: true, status: true, currentHoleNumber: true }
      }
    }
  });
  if (!invite) throw new NotFoundError('Invite not found');
  if (!invite.round) throw new BadRequestError('Round has not started yet');
  if (invite.round.status !== 'IN_PROGRESS') throw new BadRequestError('Round is no longer in progress');
  return { roundId: invite.round.id, currentHoleNumber: invite.round.currentHoleNumber };
};

/** Lägg till en användare som spelare i rundan (idempotent). */
const addPlayer = async (roundId: string, userId: string) => {
  const existing = await prisma.roundPlayer.findUnique({
    where: { roundId_userId: { roundId, userId } },
    select: { id: true }
  });
  if (existing) return;
  const last = await prisma.roundPlayer.findFirst({
    where: { roundId },
    orderBy: { order: 'desc' },
    select: { order: true }
  });
  await prisma.roundPlayer.create({
    data: {
      roundId,
      userId,
      displayNameSnapshot: await getDisplayName(userId),
      order: (last?.order ?? 0) + 1
    }
  });
};

export const joinService = {
  /**
   * Skapa (eller återanvänd) hostens QR-invitekod. Visas innan rundan
   * skapats — inviten binds till rundan först när hosten startar den
   * (roundsService.createRound), så att den alltid pekar på den nya rundan
   * och inte en ev. kvarglömd pågående.
   */
  async createInvite(hostUserId: string) {
    const existing = await prisma.roundInvite.findFirst({
      where: {
        hostUserId,
        roundId: null,
        createdAt: { gte: new Date(Date.now() - INVITE_TTL_MS) }
      },
      orderBy: { createdAt: 'desc' }
    });
    if (existing) return { code: existing.code };

    const code = crypto.randomBytes(9).toString('base64url');
    await prisma.roundInvite.create({ data: { code, hostUserId } });
    return { code };
  },

  /** Publik info till join-sidan. `round` är null tills hosten startat. */
  async getInviteInfo(code: string) {
    const invite = await prisma.roundInvite.findUnique({
      where: { code },
      include: {
        host: { select: { email: true, profile: { select: { displayName: true } } } },
        round: {
          select: {
            id: true,
            status: true,
            currentHoleNumber: true,
            courseNameSnapshot: true,
            clubNameSnapshot: true
          }
        }
      }
    });
    if (!invite) throw new NotFoundError('Invite not found');

    const joinable = invite.round?.status === 'IN_PROGRESS';
    return {
      hostName: invite.host.profile?.displayName ?? invite.host.email,
      roundStatus: invite.round?.status ?? null,
      round: joinable && invite.round
        ? {
            roundId: invite.round.id,
            currentHoleNumber: invite.round.currentHoleNumber,
            courseName: invite.round.courseNameSnapshot,
            clubName: invite.round.clubNameSnapshot
          }
        : null
    };
  },

  /** Joina som inloggad användare. */
  async joinAsUser(code: string, userId: string) {
    const { roundId, currentHoleNumber } = await getJoinableInvite(code);
    await addPlayer(roundId, userId);
    return { roundId, currentHoleNumber };
  },

  /**
   * Joina som gäst: skapar ett gästkonto (osynligt i sök, kan uppgraderas
   * via /auth/claim-guest) och loggar in det direkt.
   */
  async joinAsGuest(code: string, name: string, meta: { ip?: string; userAgent?: string }) {
    const { roundId, currentHoleNumber } = await getJoinableInvite(code);

    const email = `guest_${crypto.randomBytes(8).toString('hex')}@guest.kaddy.invalid`;
    const passwordHash = await passwordService.hash(crypto.randomBytes(24).toString('base64url'));
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        isGuest: true,
        profile: { create: { displayName: name } }
      }
    });

    await addPlayer(roundId, user.id);
    const tokens = await authService.issueTokenPair(user.id, meta);
    return { tokens, roundId, currentHoleNumber };
  }
};
