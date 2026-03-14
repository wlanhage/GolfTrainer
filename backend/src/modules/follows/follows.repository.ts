import { prisma } from '../../infrastructure/prisma/client.js';

export const followsRepository = {
  async followUser(followerUserId: string, followingUserId: string) {
    return prisma.userFollow.upsert({
      where: {
        followerUserId_followingUserId: {
          followerUserId,
          followingUserId
        }
      },
      update: {},
      create: { followerUserId, followingUserId }
    });
  },

  unfollowUser(followerUserId: string, followingUserId: string) {
    return prisma.userFollow.deleteMany({ where: { followerUserId, followingUserId } });
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
    }>>`
      SELECT
        r.id as "roundId",
        r."userId" as "userId",
        COALESCE(up."displayName", u.email) as username,
        c."courseName" as course,
        r."totalScore" as "totalScore",
        r."startedAt" as "startedAt"
      FROM "user_follows" uf
      JOIN "Round" r ON r."userId" = uf."following_user_id"
      JOIN "User" u ON u.id = r."userId"
      LEFT JOIN "UserProfile" up ON up."userId" = u.id
      JOIN "Course" c ON c.id = r."courseId"
      WHERE uf."follower_user_id" = ${viewerUserId}
        AND r."totalScore" IS NOT NULL
      ORDER BY r."startedAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
};
