import { prisma } from '../../infrastructure/prisma/client.js';

export const followsRepository = {
  async followUser(followerUserId: string, followingUserId: string) {
    // Idempotent: returnerar befintlig follow om den finns, annars skapa.
    // (Undviker upsert med tom update som kan trippa i vissa Prisma-versioner.)
    const existing = await prisma.userFollow.findUnique({
      where: {
        followerUserId_followingUserId: { followerUserId, followingUserId }
      }
    });
    if (existing) return existing;
    return prisma.userFollow.create({
      data: { followerUserId, followingUserId }
    });
  },

  unfollowUser(followerUserId: string, followingUserId: string) {
    return prisma.userFollow.deleteMany({ where: { followerUserId, followingUserId } });
  },

  /**
   * Returnerar listan av users som user följer OCH som följer user tillbaka.
   * Används av runda-flödet för player picker.
   */
  async getMutualFollowers(userId: string) {
    // De jag följer
    const following = await prisma.userFollow.findMany({
      where: { followerUserId: userId },
      select: { followingUserId: true }
    });
    const followingIds = following.map((f) => f.followingUserId);
    if (followingIds.length === 0) return [];

    // De som följer mig OCH finns i listan ovan
    const mutuals = await prisma.userFollow.findMany({
      where: {
        followingUserId: userId,
        followerUserId: { in: followingIds }
      },
      include: {
        follower: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true, avatarImage: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return mutuals.map((m) => ({
      userId: m.follower.id,
      displayName: m.follower.profile?.displayName ?? m.follower.email,
      avatarImage: m.follower.profile?.avatarImage ?? null
    }));
  },

  isFollowing(followerUserId: string, followingUserId: string) {
    return prisma.userFollow.findUnique({
      where: {
        followerUserId_followingUserId: {
          followerUserId,
          followingUserId
        }
      },
      select: { id: true }
    });
  },

  getFollowers(userId: string, limit: number, offset: number) {
    return prisma.userFollow.findMany({
      where: { followingUserId: userId },
      include: {
        follower: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  },

  getFollowing(userId: string, limit: number, offset: number) {
    return prisma.userFollow.findMany({
      where: { followerUserId: userId },
      include: {
        following: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  },

  getFollowCounts(userId: string) {
    return prisma.$transaction([
      prisma.userFollow.count({ where: { followingUserId: userId } }),
      prisma.userFollow.count({ where: { followerUserId: userId } })
    ]);
  },

  getFollowedLeaderboard(viewerUserId: string, limit: number, offset: number) {
    return prisma.$queryRaw<Array<{
      userId: string;
      username: string;
      roundsPlayed: number;
      avgScore: number;
      bestScore: number;
      lastRoundAt: Date;
    }>>`
      WITH social_scope AS (
        SELECT "following_user_id" AS user_id
        FROM "user_follows"
        WHERE "follower_user_id" = ${viewerUserId}
        UNION
        SELECT ${viewerUserId}
      )
      SELECT
        r."userId" as "userId",
        COALESCE(up."displayName", u.email) as username,
        COUNT(*)::int as "roundsPlayed",
        AVG(r."totalScore")::float as "avgScore",
        MIN(r."totalScore")::int as "bestScore",
        MAX(r."startedAt") as "lastRoundAt"
      FROM "Round" r
      JOIN social_scope s ON s.user_id = r."userId"
      JOIN "User" u ON u.id = r."userId"
      LEFT JOIN "UserProfile" up ON up."userId" = u.id
      WHERE r."totalScore" IS NOT NULL
      GROUP BY r."userId", up."displayName", u.email
      ORDER BY "avgScore" ASC, "bestScore" ASC, "roundsPlayed" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  },

  getFollowedCourseLeaderboard(viewerUserId: string, courseId: string, limit: number, offset: number) {
    return prisma.$queryRaw<Array<{
      userId: string;
      username: string;
      courseId: string;
      roundsPlayed: number;
      avgScore: number;
      bestScore: number;
      lastRoundAt: Date;
    }>>`
      WITH social_scope AS (
        SELECT "following_user_id" AS user_id
        FROM "user_follows"
        WHERE "follower_user_id" = ${viewerUserId}
        UNION
        SELECT ${viewerUserId}
      )
      SELECT
        r."userId" as "userId",
        COALESCE(up."displayName", u.email) as username,
        r."courseId" as "courseId",
        COUNT(*)::int as "roundsPlayed",
        AVG(r."totalScore")::float as "avgScore",
        MIN(r."totalScore")::int as "bestScore",
        MAX(r."startedAt") as "lastRoundAt"
      FROM "Round" r
      JOIN social_scope s ON s.user_id = r."userId"
      JOIN "User" u ON u.id = r."userId"
      LEFT JOIN "UserProfile" up ON up."userId" = u.id
      WHERE r."courseId" = ${courseId}
        AND r."totalScore" IS NOT NULL
      GROUP BY r."userId", up."displayName", u.email, r."courseId"
      ORDER BY "avgScore" ASC, "bestScore" ASC, "roundsPlayed" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  },

  getFollowingFeed(viewerUserId: string, limit: number, offset: number) {
    return prisma.$queryRaw<Array<{
      roundId: string;
      userId: string;
      username: string;
      course: string;
      totalScore: number;
      startedAt: Date;
      hostPlayerId: string | null;
    }>>`
      SELECT
        r.id as "roundId",
        r."userId" as "userId",
        COALESCE(up."displayName", u.email) as username,
        c."courseName" as course,
        r."totalScore" as "totalScore",
        r."startedAt" as "startedAt",
        rp.id as "hostPlayerId"
      FROM "user_follows" uf
      JOIN "Round" r ON r."userId" = uf."following_user_id"
      JOIN "User" u ON u.id = r."userId"
      LEFT JOIN "UserProfile" up ON up."userId" = u.id
      JOIN "Course" c ON c.id = r."courseId"
      LEFT JOIN "RoundPlayer" rp ON rp."roundId" = r.id AND rp."userId" = r."userId"
      WHERE uf."follower_user_id" = ${viewerUserId}
        AND r."totalScore" IS NOT NULL
      ORDER BY r."startedAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
};
