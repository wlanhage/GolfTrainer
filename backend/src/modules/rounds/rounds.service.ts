import { prisma } from '../../infrastructure/prisma/client.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors/AppError.js';
import { roundsRepository } from './rounds.repository.js';
import { notificationsService } from '../notifications/notifications.service.js';
import type {
  CreateRoundInput,
  CreateRoundShotInput,
  ListRoundsQuery,
  UpdatePlayerScoreInput,
  UpdateRoundHoleInput,
  UpdateRoundInput
} from './rounds.schema.js';
import type { HoleLayout } from '@prisma/client';
import type { RoundFormat } from '@prisma/client';

const EARTH_RADIUS_M = 6371000;
const toRadians = (v: number) => (v * Math.PI) / 180;
const getGeoDistanceMeters = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

// ─── Green geometry (for the watch's front/back distances) ───────────────────
//
// The data model stores a `greenPolygon` (GeoJSON-ish) + an optional
// `holeBearing`, not explicit front/back points. We derive them by projecting
// the green's outline onto the play direction: the nearest vertex (along the
// tee→green bearing) is the FRONT of the green, the farthest is the BACK.

type LatLng = { lat: number; lng: number };

const fromCoordPairs = (arr: unknown[]): Array<[number, number]> | null => {
  const points = arr
    .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
    .map((p) => [Number(p[0]), Number(p[1])] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  return points.length ? points : null;
};

/**
 * Outer ring as [lng, lat] pairs. Handles the real DB format
 * (GeoPoint[] = [{lat,lng}, ...]) plus GeoJSON fallbacks.
 */
const extractRing = (polygon: unknown): Array<[number, number]> | null => {
  if (!polygon) return null;

  if (Array.isArray(polygon)) {
    const first = polygon[0];
    if (first && typeof first === 'object' && !Array.isArray(first) && 'lat' in first && 'lng' in first) {
      const ring = polygon
        .filter((p): p is { lat: number; lng: number } =>
          !!p && typeof (p as { lat?: unknown }).lat === 'number' && typeof (p as { lng?: unknown }).lng === 'number')
        .map((p) => [p.lng, p.lat] as [number, number]);
      return ring.length ? ring : null;
    }
    if (Array.isArray(first)) return fromCoordPairs(polygon);
    return null;
  }

  if (typeof polygon === 'object') {
    const geom = ('geometry' in polygon ? (polygon as { geometry?: unknown }).geometry : polygon) as
      | { coordinates?: unknown }
      | undefined;
    const coords = geom?.coordinates;
    if (Array.isArray(coords) && Array.isArray(coords[0])) return fromCoordPairs(coords[0] as unknown[]);
  }
  return null;
};

/** A GeoJSON Point ([lng,lat]) or a {lat,lng} object → LatLng, or null. */
const extractPoint = (point: unknown): LatLng | null => {
  if (!point || typeof point !== 'object') return null;
  const geom = ('geometry' in point ? (point as { geometry?: unknown }).geometry : point) as
    | { coordinates?: unknown }
    | undefined;
  const c = geom?.coordinates;
  if (Array.isArray(c) && c.length >= 2 && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))) {
    return { lng: Number(c[0]), lat: Number(c[1]) };
  }
  const obj = point as { lat?: unknown; lng?: unknown };
  if (typeof obj.lat === 'number' && typeof obj.lng === 'number') return { lat: obj.lat, lng: obj.lng };
  return null;
};

const bearingDeg = (from: LatLng, to: LatLng): number => {
  const φ1 = toRadians(from.lat);
  const φ2 = toRadians(to.lat);
  const Δλ = toRadians(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180) / Math.PI;
};

/** Front (nearest) and back (farthest) green points along the play direction. */
const deriveGreenEnds = (
  layout: HoleLayout | null | undefined
): { greenFront: LatLng | null; greenBack: LatLng | null } => {
  if (!layout) return { greenFront: null, greenBack: null };
  const ring = extractRing(layout.greenPolygon);
  if (!ring || ring.length < 2) return { greenFront: null, greenBack: null };

  const lat0 = ring.reduce((s, [, lat]) => s + lat, 0) / ring.length;
  const lng0 = ring.reduce((s, [lng]) => s + lng, 0) / ring.length;

  let bearing: number | null =
    layout.holeBearing != null && Number.isFinite(Number(layout.holeBearing))
      ? Number(layout.holeBearing)
      : null;
  if (bearing == null) {
    const tee = extractPoint(layout.teePoint);
    if (tee) bearing = bearingDeg(tee, { lat: lat0, lng: lng0 });
  }

  // No orientation available → fall back to the two farthest-apart vertices.
  if (bearing == null) {
    let best = -1;
    let a: LatLng | null = null;
    let b: LatLng | null = null;
    for (let i = 0; i < ring.length; i++) {
      for (let j = i + 1; j < ring.length; j++) {
        const d = getGeoDistanceMeters(ring[i][1], ring[i][0], ring[j][1], ring[j][0]);
        if (d > best) {
          best = d;
          a = { lat: ring[i][1], lng: ring[i][0] };
          b = { lat: ring[j][1], lng: ring[j][0] };
        }
      }
    }
    return { greenFront: a, greenBack: b };
  }

  const θ = toRadians(bearing);
  const ux = Math.sin(θ); // east component of play direction
  const uy = Math.cos(θ); // north component
  let minP = Infinity;
  let maxP = -Infinity;
  let front: LatLng | null = null;
  let back: LatLng | null = null;
  for (const [lng, lat] of ring) {
    const north = (lat - lat0) * 111320;
    const east = (lng - lng0) * 111320 * Math.cos(toRadians(lat0));
    const proj = east * ux + north * uy;
    if (proj < minP) {
      minP = proj;
      front = { lat, lng };
    }
    if (proj > maxP) {
      maxP = proj;
      back = { lat, lng };
    }
  }
  return { greenFront: front, greenBack: back };
};

const assertParticipant = async (roundId: string, userId: string) => {
  const player = await prisma.roundPlayer.findUnique({
    where: { roundId_userId: { roundId, userId } }
  });
  if (!player) throw new ForbiddenError('You are not a participant in this round');
};

const DEFAULT_FORMAT: RoundFormat = 'STROKE_PLAY';

const getFollowerUserIds = async (userId: string): Promise<string[]> => {
  const rows = await prisma.userFollow.findMany({
    where: { followingUserId: userId },
    select: { followerUserId: true }
  });
  return rows.map((r) => r.followerUserId);
};

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

    const created = await roundsRepository.createRound({
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

    // Notisera alla inbjudna spelare om att rundan har börjat.
    // Fire-and-forget — runda skapas oavsett om notiserna lyckas.
    const invitedUserIds = invitedPlayers.map((p) => p.userId);
    if (invitedUserIds.length > 0) {
      notificationsService
        .notifyRoundStarted(invitedUserIds, hostDisplayName, course.courseName, created.id)
        .catch(() => undefined);
    }

    // Notisera host's egna followers om att hen startat en runda — men hoppa
    // över de som redan fått ROUND_STARTED som inbjudna spelare.
    void getFollowerUserIds(hostUserId)
      .then((followerIds) => {
        const exclude = new Set([hostUserId, ...invitedUserIds]);
        const targets = followerIds.filter((id) => !exclude.has(id));
        if (targets.length === 0) return;
        return notificationsService.notifyFriendStartedRound(
          targets,
          hostDisplayName,
          hostUserId,
          course.courseName
        );
      })
      .catch(() => undefined);

    return created;
  },

  listForUser(userId: string, query: ListRoundsQuery) {
    return roundsRepository.listForUser(userId, {
      status: query.status,
      limit: query.limit,
      offset: query.offset
    });
  },

  /** Admin: list ALL rounds across the platform. */
  adminListAll(query: ListRoundsQuery) {
    return roundsRepository.adminListAll({
      status: query.status,
      limit: query.limit,
      offset: query.offset
    });
  },

  adminStats() {
    return roundsRepository.adminStats();
  },

  async adminRecomputeTotalScore(roundId: string) {
    const total = await roundsRepository.adminRecomputeTotalScore(roundId);
    return { roundId, totalScore: total };
  },

  async getById(roundId: string, userId: string) {
    const round = await roundsRepository.getByIdForParticipant(roundId, userId);
    if (!round) throw new NotFoundError('Round not found');
    return round;
  },

  /**
   * Watch companion: the caller's currently in-progress round, reduced to just
   * what the play view needs. Throws NotFound (→ 404) when there's none.
   */
  async getActiveRound(userId: string) {
    const round = await prisma.round.findFirst({
      where: {
        status: 'IN_PROGRESS',
        OR: [{ userId }, { players: { some: { userId, leftAt: null } } }]
      },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        currentHoleNumber: true,
        players: { where: { userId }, select: { id: true } }
      }
    });
    if (!round) throw new NotFoundError('No active round');

    const myPlayerId = round.players[0]?.id ?? '__none__';
    const roundHole = await prisma.roundHole.findFirst({
      where: { roundId: round.id, holeNumber: round.currentHoleNumber },
      include: {
        hole: { include: { holeLayout: true } },
        scores: { where: { playerId: myPlayerId }, select: { strokes: true } }
      }
    });
    if (!roundHole) throw new NotFoundError('Current hole not found');

    const { greenFront, greenBack } = deriveGreenEnds(roundHole.hole.holeLayout);

    return {
      roundId: round.id,
      currentHole: {
        id: roundHole.id,
        holeNumber: roundHole.holeNumber,
        par: roundHole.parSnapshot ?? roundHole.hole.par ?? 0,
        strokes: roundHole.scores[0]?.strokes ?? 0,
        greenFront,
        greenBack
      }
    };
  },

  /** Watch companion: advance the round to the next hole (clamped to hole count). */
  async advanceToNextHole(roundId: string, userId: string) {
    await assertParticipant(roundId, userId);
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { currentHoleNumber: true }
    });
    if (!round) throw new NotFoundError('Round not found');

    const holeCount = await prisma.roundHole.count({ where: { roundId } });
    const nextHoleNumber = Math.min(round.currentHoleNumber + 1, Math.max(holeCount, 1));

    const updated = await prisma.round.update({
      where: { id: roundId },
      data: { currentHoleNumber: nextHoleNumber },
      select: { id: true, currentHoleNumber: true }
    });
    return { roundId: updated.id, currentHoleNumber: updated.currentHoleNumber };
  },

  /** Watch companion: set the calling player's strokes on a hole (by holeNumber). */
  async updateMyStrokes(roundId: string, userId: string, holeNumber: number, strokes: number) {
    const player = await prisma.roundPlayer.findUnique({
      where: { roundId_userId: { roundId, userId } },
      select: { id: true }
    });
    if (!player) throw new ForbiddenError('You are not a participant in this round');

    const updated = await roundsRepository.upsertPlayerScore(roundId, userId, holeNumber, player.id, {
      strokes
    });
    if (!updated) throw new NotFoundError('Round or hole not found');
    return updated;
  },

  /** Public read-only — any authenticated user can view any completed round. */
  async getByIdPublic(roundId: string) {
    const round = await roundsRepository.getByIdPublic(roundId);
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
        .handleRoundCompleted(
          updated.userId,
          roundId,
          updated.totalScore,
          updated.courseNameSnapshot
        )
        .catch(() => undefined);
    }

    return updated;
  },

  /**
   * Vid COMPLETED-runda:
   *  1. Räkna ut totalPar och relativeToPar
   *  2. Personligt rekord? → push + in-app notification
   *  3. Spelade till sin HCP (±3)? → notisera host's followers
   */
  async handleRoundCompleted(
    userId: string,
    currentRoundId: string,
    currentScore: number,
    courseNameSnapshot: string
  ) {
    // Räkna ut totalPar från snapshots så vi har relativeToPar
    const par = await prisma.roundHole.aggregate({
      where: { roundId: currentRoundId },
      _sum: { parSnapshot: true }
    });
    const totalPar = par._sum.parSnapshot ?? 0;
    const relativeToPar = currentScore - totalPar;

    // Personligt rekord — jämför med tidigare COMPLETED-rundor på samma bana
    const round = await prisma.round.findUnique({
      where: { id: currentRoundId },
      select: { courseId: true }
    });
    const previousBest = round
      ? await prisma.round.findFirst({
          where: {
            userId,
            courseId: round.courseId,
            status: 'COMPLETED',
            totalScore: { not: null },
            id: { not: currentRoundId }
          },
          orderBy: { totalScore: 'asc' },
          select: { totalScore: true }
        })
      : null;
    const isPersonalBest = previousBest === null || currentScore < previousBest.totalScore!;

    if (isPersonalBest) {
      // notifyPersonalBest now fires both in-app + push internally.
      notificationsService
        .notifyPersonalBest(userId, courseNameSnapshot, relativeToPar, currentRoundId)
        .catch(() => undefined);
    }

    // "Spelade till sin HCP" — relativeToPar inom ±3 av användarens HCP →
    // notisera den här användarens followers så de ser en kort höjdpunkt.
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { displayName: true, handicap: true }
    });
    const hcp = profile?.handicap === null || profile?.handicap === undefined ? null : Number(profile.handicap);
    if (hcp !== null && Number.isFinite(hcp)) {
      const delta = Math.abs(relativeToPar - hcp);
      if (delta <= 3) {
        const followerIds = await getFollowerUserIds(userId);
        if (followerIds.length > 0) {
          notificationsService
            .notifyFriendFinishedNotable(
              followerIds,
              profile?.displayName ?? 'En vän',
              userId,
              courseNameSnapshot,
              relativeToPar
            )
            .catch(() => undefined);
        }
      }
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
  },

  async leaveRound(roundId: string, userId: string) {
    const result = await roundsRepository.markPlayerLeft(roundId, userId);
    if (!result.ok) {
      if (result.reason === 'not_found') throw new NotFoundError('Round player not found');
      if (result.reason === 'already_left') throw new BadRequestError('You have already left this round');
    }
  },

  async setRoundImage(roundId: string, userId: string, image: string) {
    const result = await roundsRepository.setImage(roundId, userId, image);
    if (!result.ok) {
      if (result.reason === 'not_found') throw new NotFoundError('Round not found');
      if (result.reason === 'forbidden') throw new ForbiddenError('Only the round host can add an image');
      if (result.reason === 'already_set') throw new BadRequestError('Round image is already set');
    }
    return result.round;
  },

  async createRoundShot(roundId: string, userId: string, input: CreateRoundShotInput) {
    await assertParticipant(roundId, userId);

    // Compute next shotOrder for this round+hole
    const lastShot = await prisma.roundShot.findFirst({
      where: { roundId, holeNumber: input.holeNumber },
      orderBy: { shotOrder: 'desc' },
      select: { shotOrder: true }
    });
    const shotOrder = (lastShot?.shotOrder ?? 0) + 1;

    // Compute distance if both from/to are provided
    let distanceMeters: number | undefined;
    if (input.toLat !== undefined && input.toLng !== undefined) {
      distanceMeters = getGeoDistanceMeters(input.fromLat, input.fromLng, input.toLat, input.toLng);
    }

    return prisma.roundShot.create({
      data: {
        roundId,
        holeNumber: input.holeNumber,
        shotOrder,
        clubId: input.clubId,
        fromLat: input.fromLat,
        fromLng: input.fromLng,
        toLat: input.toLat,
        toLng: input.toLng,
        distanceMeters: distanceMeters !== undefined ? Math.round(distanceMeters * 10) / 10 : undefined
      }
    });
  },

  async getRoundShots(roundId: string, userId: string) {
    await assertParticipant(roundId, userId);
    return prisma.roundShot.findMany({
      where: { roundId },
      orderBy: [{ holeNumber: 'asc' }, { shotOrder: 'asc' }]
    });
  },

  async deleteRoundShot(roundId: string, userId: string, shotId: string) {
    await assertParticipant(roundId, userId);
    const shot = await prisma.roundShot.findUnique({ where: { id: shotId } });
    if (!shot || shot.roundId !== roundId) throw new NotFoundError('Shot not found');
    await prisma.roundShot.delete({ where: { id: shotId } });
  }
};
