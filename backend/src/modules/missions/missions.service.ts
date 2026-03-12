import { NotFoundError } from '../../common/errors/AppError.js';
import { missionsRepository } from './missions.repository.js';

function toMissionDto(mission: Awaited<ReturnType<typeof missionsRepository.getById>>) {
  if (!mission) return null;

  return {
    ...mission,
    defaultScore: mission.defaultScore ? Number(mission.defaultScore) : null,
    maxScore: mission.maxScore ? Number(mission.maxScore) : null,
    leaderboardEntries: mission.leaderboardEntries.map((entry) => ({
      id: entry.id,
      score: Number(entry.score),
      submittedAt: entry.submittedAt,
      userId: entry.userId,
      playerName: entry.user.profile?.displayName ?? entry.user.email
    }))
  };
}

export const missionsService = {
  async listForTrainingNavigation() {
    const missions = await missionsRepository.listForTrainingNavigation();
    return missions.map((mission) => ({
      ...mission,
      defaultScore: mission.defaultScore ? Number(mission.defaultScore) : null,
      maxScore: mission.maxScore ? Number(mission.maxScore) : null,
      leaderboardEntries: mission.leaderboardEntries.map((entry) => ({
        id: entry.id,
        score: Number(entry.score),
        submittedAt: entry.submittedAt,
        userId: entry.userId,
        playerName: entry.user.profile?.displayName ?? entry.user.email
      }))
    }));
  },

  async getById(id: string) {
    const mission = await missionsRepository.getById(id);
    if (!mission || mission.status !== 'PUBLISHED') {
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
  }
};
