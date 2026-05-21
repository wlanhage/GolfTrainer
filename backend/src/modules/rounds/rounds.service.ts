import { prisma } from '../../infrastructure/prisma/client.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors/AppError.js';
import { roundsRepository } from './rounds.repository.js';
import { pushService } from '../push/push.service.js';
import type {
  CreateRoundInput,
  ListRoundsQuery,
  UpdatePlayerScoreInput,
  UpdateRoundHoleInput,
  UpdateRoundInput
} from './rounds.schema.js';
import type { RoundFormat } from '@prisma/client';

const DEFAULT_FORMAT: RoundFormat = 'STROKE_PLAY';

const getDisplayName = async (userId: string): Promise<string> => {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { displayName: true }
  });
  if (profile) return profile.displayName;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return u?.email ?? 'Spelare';
};

/**
 * Validerar att hostUserId och targetUserId är mutuella followers
 * (follower & following i båda riktningar).
 */
const areMutualFollowers = async (a: string, b: string): Promise<boolean> => {
  if (a === b) return true;
  const both = await prisma.userFollow.findMany({
    where: {
      OR: [
        { followerUserId: a, followingUserId: b },
        { followerUserId: b, followingUserId: a }
      ]
    },
    select: { followerUserId: true }
  });
  return both.length === 2;
};

export const roundsService = {
  async createRound(hostUserId: string, input: CreateRoundInput) {
    const course = await prisma.course.findUnique({
      where: { id: input.courseId },
      include: { holes: { orderBy: { holeNumber: 'asc' } } }
    });
    if (!course) throw new NotFoundError('Course not found');
    if (course.holes.length === 0) {
      throw new BadRequestError('Course has no holes — create holes first.');
    }

    const format: RoundFormat = (input.format as RoundFormat | undefined) ?? DEFAULT_FORMAT;

    // Sätt ihop spelare: host alltid på order 0, sedan inbjudna i samma ordning som de skickades.
    const invitedPlayers = input.players ?? [];
    const seenUserIds = new Set<string>([hostUserId]);
    for (const p of invitedPlayers) {
      if (seenUserIds.has(p.userId)) {
        throw new BadRequestError('Duplicate player in round');
      }
      seenUserIds.add(p.userId);

      // För grupp-format krävs mutual follow för att kunna bjuda in
      const ok = await areMutualFollowers(hostUserId, p.userId);
      if (!ok) {
        throw new ForbiddenError('Can only invite users who follow you back');
      }
    }

    const hostDisplayName = await getDisplayName(hostUserId);
    const allPlayers = [
      {
        userId: hostUserId,
        displayNameSnapshot: hostDisplayName,
        team: null as string | null,
        order: 0
      },
      ...(await Promise.all(
        invitedPlayers.map(async (p, idx) => ({
          userId: p.userId,
          displayNameSnapshot: await getDisplayName(p.userId),
          team: p.team ?? null,
          order: idx + 1
        }))
      ))
    ];

    return roundsRepository.createRound({
      hostUserId,
      courseId: input.courseId,
      courseNameSnapshot: course.courseName,
      clubNameSnapshot: course.clubName,
      teeNameSnapshot: course.teeName ?? null,
      format,
      holes: course.holes.map((h) => ({
        holeId: h.id,
        holeNumber: h.holeNumber,
        par: h.par,
        length: h.length,
        hcpIndex: h.hcpIndex
      })),
      players: allPlayers
    });
  },

  listForUser(userId: string, query: ListRoundsQuery) {
    return roundsRepository.listForUser(userId, {
      status: query.status,
      limit: query.limit,
      offset: query.offset
    });
  },

  async getById(roundId: string, userId: string) {
    const round = await roundsRepository.getByIdForParticipant(roundId, userId);
    if (!round) throw new NotFoundError('Round not found');
    return round;
  },

  async updateRound(roundId: string, userId: string, input: UpdateRoundInput) {
    const patch: Parameters<typeof roundsRepository.updateRound>[2] = { ...input };
    if (input.status === 'COMPLETED' || input.status === 'ABANDONED') {
      patch.finishedAt = new Date();
      patch.totalScore = await roundsRepository.computeTotalScore(roundId);
    }
    const updated = await roundsRepository.updateRound(roundId, userId, patch);
    if (!updated) throw new NotFoundError('Round not found');

    if (input.status === 'COMPLETED' && updated.totalScore !== null) {
      roundsService
        .checkAndNotifyPersonalBest(updated.userId, roundId, updated.totalScore, updated.courseNameSnapshot)
        .catch(() => undefined);
    }

    return updated;
  },

  async checkAndNotifyPersonalBest(
    userId: string,
    currentRoundId: string,
    currentScore: number,
    courseNameSnapshot: string
  ) {
    const previousBest = await prisma.round.findFirst({
      where: {
        userId,
        status: 'COMPLETED',
        totalScore: { not: null },
        id: { not: currentRoundId }
      },
      orderBy: { totalScore: 'asc' },
      select: { totalScore: true }
    });

    const isPersonalBest = previousBest === null || currentScore < previousBest.totalScore!;

    if (isPersonalBest) {
      const sign = currentScore > 0 ? `+${currentScore}` : String(currentScore);
      await pushService.sendPushToUser(userId, {
        title: 'Personligt rekord!',
        body: `Du slog ditt rekord på ${courseNameSnapshot}: ${sign}`,
        url: '/play'
      });
    }
  },

  async updateRoundHole(roundId: string, userId: string, holeNumber: number, input: UpdateRoundHoleInput) {
    const updated = await roundsRepository.updateRoundHole(roundId, userId, holeNumber, input);
    if (!updated) throw new NotFoundError('Round hole not found');
    return updated;
  },

  async updatePlayerScore(
    roundId: string,
    userId: string,
    holeNumber: number,
    playerId: string,
    input: UpdatePlayerScoreInput
  ) {
    const updated = await roundsRepository.upsertPlayerScore(roundId, userId, holeNumber, playerId, input);
    if (!updated) throw new NotFoundError('Round, hole, or player not found');
    return updated;
  },

  async deleteRound(roundId: string, userId: string) {
    const ok = await roundsRepository.deleteRound(roundId, userId);
    if (!ok) throw new NotFoundError('Round not found');
  }
};
