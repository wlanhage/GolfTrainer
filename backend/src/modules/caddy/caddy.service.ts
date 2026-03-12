import { ForbiddenError, NotFoundError } from '../../common/errors/AppError.js';
import { usersRepository } from '../users/users.repository.js';
import { CADDY_CLUBS } from './caddy.constants.js';
import { caddyRepository } from './caddy.repository.js';

type ShotMetric = {
  id: string;
  clubKey: string;
  distanceMeters: number;
  lateralOffsetMeters: number;
  peakHeightMeters?: number;
  spinRpm?: number;
  recordedAt: Date;
};

const clubByKey = new Map<string, (typeof CADDY_CLUBS)[number]>(CADDY_CLUBS.map((club) => [club.key, club]));

const resolveTargetUserId = async (authUserId: string, requestedUserId?: string) => {
  if (!requestedUserId || requestedUserId === authUserId) {
    return authUserId;
  }

  const requester = await usersRepository.getById(authUserId);
  if (requester?.role !== 'ADMIN') {
    throw new ForbiddenError('Only admins can access another player\'s caddy data');
  }

  return requestedUserId;
};

const getTrimmedValues = (values: number[]) => {
  if (values.length === 0) {
    return [];
  }

  const sorted = [...values].sort((a, b) => a - b);

  if (sorted.length <= 20) {
    return sorted;
  }

  const trimCount = Math.floor(sorted.length * 0.05);
  if (trimCount < 1 || trimCount * 2 >= sorted.length) {
    return sorted;
  }

  return sorted.slice(trimCount, sorted.length - trimCount);
};

const average = (values: number[]) => {
  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const parseShotNotes = (notes: string | null) => {
  if (!notes) {
    return {} as { peakHeightMeters?: number; spinRpm?: number };
  }

  try {
    const parsed = JSON.parse(notes) as { peakHeightMeters?: number; spinRpm?: number };
    return parsed;
  } catch {
    return {} as { peakHeightMeters?: number; spinRpm?: number };
  }
};

const mapShot = (shot: {
  id: string;
  userClub: { label: string } | null;
  carryMeters: number | null;
  curveDeg: number | null;
  notes: string | null;
  recordedAt: Date;
}): ShotMetric | null => {
  const key = CADDY_CLUBS.find((club) => club.label === shot.userClub?.label)?.key;
  if (!key || shot.carryMeters === null || shot.curveDeg === null) {
    return null;
  }

  const note = parseShotNotes(shot.notes);
  const result: ShotMetric = {
    id: shot.id,
    clubKey: key,
    distanceMeters: Number(shot.carryMeters),
    lateralOffsetMeters: Number(shot.curveDeg),
    recordedAt: shot.recordedAt
  };

  if (note.peakHeightMeters !== undefined) {
    result.peakHeightMeters = note.peakHeightMeters;
  }

  if (note.spinRpm !== undefined) {
    result.spinRpm = note.spinRpm;
  }

  return result;
};

export const caddyService = {
  async listClubSummaries(authUserId: string, requestedUserId?: string) {
    const targetUserId = await resolveTargetUserId(authUserId, requestedUserId);
    const shots = await caddyRepository.listShotsByUser(targetUserId);

    const mappedShots: ShotMetric[] = [];

    for (const shot of shots) {
      const mapped = mapShot({
        id: shot.id,
        userClub: shot.userClub,
        carryMeters: shot.carryMeters === null ? null : Number(shot.carryMeters),
        curveDeg: shot.curveDeg === null ? null : Number(shot.curveDeg),
        notes: shot.notes,
        recordedAt: shot.recordedAt
      });

      if (mapped) {
        mappedShots.push(mapped);
      }
    }

    return CADDY_CLUBS.map((club) => {
      const clubShots = mappedShots.filter((shot) => shot.clubKey === club.key);
      const trimmedDistances = getTrimmedValues(clubShots.map((shot) => shot.distanceMeters));
      const trimmedOffsets = getTrimmedValues(clubShots.map((shot) => shot.lateralOffsetMeters));
      const trimmedHeights = getTrimmedValues(
        clubShots.map((shot) => shot.peakHeightMeters).filter((value): value is number => value !== undefined)
      );
      const trimmedSpins = getTrimmedValues(
        clubShots.map((shot) => shot.spinRpm).filter((value): value is number => value !== undefined)
      );

      return {
        clubKey: club.key,
        clubLabel: club.label,
        sampleCount: clubShots.length,
        trimmedSampleCount: trimmedDistances.length,
        trimPercentEachSide: clubShots.length > 20 ? 5 : 0,
        distanceMeters: average(trimmedDistances),
        dispersionMeters:
          trimmedOffsets.length > 0 ? Math.max(...trimmedOffsets) - Math.min(...trimmedOffsets) : undefined,
        peakHeightMeters: average(trimmedHeights),
        spinRpm: average(trimmedSpins)
      };
    });
  },

  async listShotsForClub(authUserId: string, clubKey: string, requestedUserId?: string) {
    const targetUserId = await resolveTargetUserId(authUserId, requestedUserId);
    const club = clubByKey.get(clubKey);
    if (!club) {
      throw new NotFoundError('Club not found');
    }

    const userClub = await caddyRepository.findUserClubByLabel(targetUserId, club.label);
    if (!userClub) {
      return [];
    }

    const shots = await caddyRepository.listShotsForClub(targetUserId, userClub.id);

    const mappedShots: ShotMetric[] = [];
    for (const shot of shots) {
      const mapped = mapShot({
        id: shot.id,
        userClub: { label: club.label },
        carryMeters: shot.carryMeters === null ? null : Number(shot.carryMeters),
        curveDeg: shot.curveDeg === null ? null : Number(shot.curveDeg),
        notes: shot.notes,
        recordedAt: shot.recordedAt
      });
      if (mapped) {
        mappedShots.push(mapped);
      }
    }

    return mappedShots;
  },

  async addShot(authUserId: string, clubKey: string, input: {
    distanceMeters: number;
    lateralOffsetMeters: number;
    peakHeightMeters?: number;
    spinRpm?: number;
    recordedAt?: Date;
  }) {
    const club = clubByKey.get(clubKey);
    if (!club) {
      throw new NotFoundError('Club not found');
    }

    const userClub =
      (await caddyRepository.findUserClubByLabel(authUserId, club.label)) ??
      (await caddyRepository.createUserClub(authUserId, club.label));

    const shot = await caddyRepository.createShot(authUserId, {
      userClubId: userClub.id,
      distanceMeters: input.distanceMeters,
      lateralOffsetMeters: input.lateralOffsetMeters,
      peakHeightMeters: input.peakHeightMeters,
      spinRpm: input.spinRpm,
      recordedAt: input.recordedAt ?? new Date()
    });

    return mapShot({
      id: shot.id,
      userClub: { label: club.label },
      carryMeters: shot.carryMeters === null ? null : Number(shot.carryMeters),
      curveDeg: shot.curveDeg === null ? null : Number(shot.curveDeg),
      notes: shot.notes,
      recordedAt: shot.recordedAt
    });
  },

  async removeShot(authUserId: string, shotId: string) {
    const shot = await caddyRepository.getShotById(authUserId, shotId);
    if (!shot) {
      throw new NotFoundError('Shot not found');
    }

    await caddyRepository.deleteShot(authUserId, shotId);
  }
};
