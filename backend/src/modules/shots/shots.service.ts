import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { shotsRepository } from './shots.repository.js';

const assertOwnership = async (userId: string, input: { userClubId: string; practiceSessionId?: string; drillAttemptId?: string }) => {
  const club = await shotsRepository.getOwnedClub(userId, input.userClubId);
  if (!club) throw new NotFoundError('Club not found');

  if (input.practiceSessionId) {
    const session = await shotsRepository.getOwnedSession(userId, input.practiceSessionId);
    if (!session) throw new NotFoundError('Practice session not found');
  }

  if (input.drillAttemptId) {
    const attempt = await shotsRepository.getOwnedAttempt(userId, input.drillAttemptId);
    if (!attempt) throw new NotFoundError('Drill attempt not found');
  }
};

export const shotsService = {
  async create(userId: string, input: {
    practiceSessionId?: string;
    drillAttemptId?: string;
    userClubId: string;
    carryMeters?: number;
    totalMeters?: number;
    launchDirectionDeg?: number;
    curveDeg?: number;
    lieType?: string;
    resultTag?: string;
    notes?: string;
    recordedAt: Date;
  }) {
    await assertOwnership(userId, input);
    return shotsRepository.create(userId, input);
  },
  list(userId: string) {
    return shotsRepository.list(userId);
  },
  async getById(userId: string, id: string) {
    const shot = await shotsRepository.getById(userId, id);
    if (!shot) throw new NotFoundError('Shot entry not found');
    return shot;
  },
  async update(userId: string, id: string, input: Record<string, unknown>) {
    if (input.userClubId || input.practiceSessionId || input.drillAttemptId) {
      await assertOwnership(userId, {
        userClubId: (input.userClubId as string) ?? (await this.getById(userId, id)).userClubId,
        practiceSessionId: input.practiceSessionId as string | undefined,
        drillAttemptId: input.drillAttemptId as string | undefined
      });
    }

    if (input.carryMeters !== undefined && Number(input.carryMeters) < 0) throw new BadRequestError('carryMeters must be >= 0');

    const res = await shotsRepository.update(userId, id, input);
    if (res.count === 0) throw new NotFoundError('Shot entry not found');
    return this.getById(userId, id);
  },
  async remove(userId: string, id: string) {
    const res = await shotsRepository.delete(userId, id);
    if (res.count === 0) throw new NotFoundError('Shot entry not found');
  }
};
