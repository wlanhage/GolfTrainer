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

const getInvite = async (code: string) => {
  const invite = await prisma.roundInvite.findUnique({
    where: { code },
    include: {
      round: {
        select: { id: true, status: true, currentHoleNumber: true }
      }
    }
  });
  if (!invite) throw new NotFoundError('Invite not found');
  if (invite.round && invite.round.status !== 'IN_PROGRESS') {
    throw new BadRequestError('Round is no longer in progress');
  }
  return invite;
};

/**
 * Gemensam join: har inviten en pågående runda läggs användaren till som
 * spelare direkt; annars registreras hen som väntande medlem och blir
 * spelare automatiskt när rundan startar.
 */
const joinInvite = async (
  invite: Awaited<ReturnType<typeof getInvite>>,
  userId: string
): Promise<
  | { status: 'joined'; roundId: string; currentHoleNumber: number }
  | { status: 'pending' }
> => {
  if (invite.round) {
    await addPlayer(invite.round.id, userId);
    return { status: 'joined', roundId: invite.round.id, currentHoleNumber: invite.round.currentHoleNumber };
  }
  await prisma.roundInviteMember.upsert({
    where: { inviteId_userId: { inviteId: invite.id, userId } },
    update: {},
    create: { inviteId: invite.id, userId }
  });
  return { status: 'pending' };
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

  /** Joina som inloggad användare — direkt, eller som väntande före start. */
  async joinAsUser(code: string, userId: string) {
    const invite = await getInvite(code);
    return joinInvite(invite, userId);
  },

  /**
   * Joina som gäst: skapar ett gästkonto (osynligt i sök, kan uppgraderas
   * via /auth/claim-guest) och loggar in det direkt. Går att göra innan
   * rundan startat — gästen blir då väntande medlem.
   */
  async joinAsGuest(code: string, name: string, meta: { ip?: string; userAgent?: string }) {
    const invite = await getInvite(code);

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

    const result = await joinInvite(invite, user.id);
    const tokens = await authService.issueTokenPair(user.id, meta);
    return { tokens, ...result };
  },

  /**
   * Körs när hosten startar sin runda: binder hostens öppna invites till
   * rundan och lägger till alla väntande medlemmar som spelare.
   */
  async attachInvitesToRound(hostUserId: string, roundId: string) {
    await prisma.roundInvite.updateMany({
      where: {
        hostUserId,
        roundId: null,
        createdAt: { gte: new Date(Date.now() - INVITE_TTL_MS) }
      },
      data: { roundId }
    });

    const members = await prisma.roundInviteMember.findMany({
      where: { invite: { roundId } },
      select: { userId: true },
      orderBy: { createdAt: 'asc' }
    });
    for (const member of members) {
      await addPlayer(roundId, member.userId);
    }
  }
};
