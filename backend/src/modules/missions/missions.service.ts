import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { missionsRepository } from './missions.repository.js';

function toMissionDto(mission: Awaited<ReturnType<typeof missionsRepository.getById>>) {
  if (!mission) return null;

  return {
    ...mission,
    defaultScore: mission.defaultScore ? Number(mission.defaultScore) : null,
    maxScore: mission.maxScore ? Number(mission.maxScore) : null,
    leaderboardEntries: mission.leaderboardEntries.map((entry) => ({
      id: entry.id,
      score: entry.score,
      submittedAt: entry.submittedAt,
      userId: entry.userId,
      playerName: entry.playerName
    }))
  };
}

const isWithinWindow = (startsAt: Date | null, endsAt: Date | null): boolean => {
  const now = new Date();
  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt < now) return false;
  return true;
};

export const missionsService = {
  async listForTrainingNavigation() {
    const missions = await missionsRepository.listForTrainingNavigation();
    return missions.map((mission) => ({
      ...mission,
      defaultScore: mission.defaultScore ? Number(mission.defaultScore) : null,
      maxScore: mission.maxScore ? Number(mission.maxScore) : null,
      leaderboardEntries: mission.leaderboardEntries.map((entry) => ({
        id: entry.id,
        score: entry.score,
        submittedAt: entry.submittedAt,
        userId: entry.userId,
        playerName: entry.playerName
      }))
    }));
  },

  async getById(id: string) {
    const mission = await missionsRepository.getById(id);
    if (!mission || mission.status !== 'PUBLISHED' || !isWithinWindow(mission.startsAt, mission.endsAt)) {
      throw new NotFoundError('Mission not found');
    }
    return toMissionDto(mission);
  },

  listAllForAdmin() {
    return missionsRepository.listAllForAdmin();
  },

  createByAdmin(createdByUserId: string, input: Parameters<typeof missionsRepository.createByAdmin>[1]) {
    return missionsRepository.createByAdmin(createdByUserId, input);
  },

  async updateByAdmin(id: string, input: Parameters<typeof missionsRepository.updateByAdmin>[1]) {
    const existing = await missionsRepository.getById(id);
    if (!existing) throw new NotFoundError('Mission not found');
    return missionsRepository.updateByAdmin(id, input);
  },

  async removeByAdmin(id: string) {
    const existing = await missionsRepository.getById(id);
    if (!existing) throw new NotFoundError('Mission not found');
    await missionsRepository.deleteByAdmin(id);
  },

  async submitEntry(userId: string, missionId: string, score: number, notes?: string) {
    const mission = await missionsRepository.getById(missionId);
    if (!mission || mission.status !== 'PUBLISHED' || !isWithinWindow(mission.startsAt, mission.endsAt)) {
      throw new NotFoundError('Mission not found or not active');
    }

    if (!Number.isFinite(score)) {
      throw new BadRequestError('Score must be a number');
    }
    if (mission.scoreInputType === 'STEPPER') {
      if (mission.stepperMin != null && score < mission.stepperMin) {
        throw new BadRequestError(`Score must be at least ${mission.stepperMin}`);
      }
      if (mission.stepperMax != null && score > mission.stepperMax) {
        throw new BadRequestError(`Score must be at most ${mission.stepperMax}`);
      }
    }
    if (mission.maxScore != null && score > Number(mission.maxScore)) {
      throw new BadRequestError(`Score exceeds maximum (${Number(mission.maxScore)})`);
    }

    const previousBest = await missionsRepository.getUserBest(userId, missionId, mission.scoreDirection);
    const entry = await missionsRepository.createEntry(userId, missionId, score, notes);
    const currentBest = await missionsRepository.getUserBest(userId, missionId, mission.scoreDirection);

    const isPB =
      currentBest !== null &&
      (previousBest === null ||
        (mission.scoreDirection === 'DESC' ? currentBest > previousBest : currentBest < previousBest));

    const rank = await missionsRepository.getRankForScore(missionId, currentBest ?? score, mission.scoreDirection);

    return {
      entry: { id: entry.id, score: Number(entry.score), submittedAt: entry.submittedAt, notes: entry.notes },
      isPB,
      previousBest,
      currentBest,
      rank
    };
  },

  async getMyHistory(userId: string, missionId: string) {
    const mission = await missionsRepository.getById(missionId);
    if (!mission) throw new NotFoundError('Mission not found');

    const entries = await missionsRepository.listMyHistory(userId, missionId, 50);
    const best = await missionsRepository.getUserBest(userId, missionId, mission.scoreDirection);
    const rank = best !== null ? await missionsRepository.getRankForScore(missionId, best, mission.scoreDirection) : null;

    return { entries, best, rank };
  }
};
