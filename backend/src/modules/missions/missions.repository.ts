import { prisma } from '../../infrastructure/prisma/client.js';

export const missionsRepository = {
  listForTrainingNavigation() {
    return prisma.missionTemplate.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        leaderboardEntries: {
          take: 10,
          orderBy: { score: 'desc' },
          include: {
            user: {
              include: { profile: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  getById(id: string) {
    return prisma.missionTemplate.findUnique({
      where: { id },
      include: {
        leaderboardEntries: {
          take: 25,
          orderBy: { score: 'desc' },
          include: { user: { include: { profile: true } } }
        }
      }
    });
  },

  listAllForAdmin() {
    return prisma.missionTemplate.findMany({
      include: { leaderboard: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  createByAdmin(createdByUserId: string, data: {
    slug: string;
    name: string;
    description: string;
    icon: string;
    objective: string;
    scoreLabel: string;
    scoreInputType: 'STEPPER' | 'MANUAL_NUMBER';
    stepperMin?: number;
    stepperMax?: number;
    defaultScore?: number;
    maxScore?: number;
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    startsAt?: string;
    endsAt?: string;
    leaderboardTitle?: string;
    leaderboardActive?: boolean;
  }) {
    return prisma.missionTemplate.create({
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        icon: data.icon,
        objective: data.objective,
        scoreLabel: data.scoreLabel,
        scoreInputType: data.scoreInputType,
        stepperMin: data.stepperMin,
        stepperMax: data.stepperMax,
        defaultScore: data.defaultScore,
        maxScore: data.maxScore,
        status: data.status,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        createdByUserId,
        leaderboard: {
          create: {
            title: data.leaderboardTitle,
            isActive: data.leaderboardActive ?? true
          }
        }
      },
      include: { leaderboard: true }
    });
  },

  updateByAdmin(id: string, data: {
    slug?: string;
    name?: string;
    description?: string;
    icon?: string;
    objective?: string;
    scoreLabel?: string;
    scoreInputType?: 'STEPPER' | 'MANUAL_NUMBER';
    stepperMin?: number;
    stepperMax?: number;
    defaultScore?: number;
    maxScore?: number;
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    startsAt?: string;
    endsAt?: string;
    leaderboardTitle?: string;
    leaderboardActive?: boolean;
  }) {
    return prisma.missionTemplate.update({
      where: { id },
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        icon: data.icon,
        objective: data.objective,
        scoreLabel: data.scoreLabel,
        scoreInputType: data.scoreInputType,
        stepperMin: data.stepperMin,
        stepperMax: data.stepperMax,
        defaultScore: data.defaultScore,
        maxScore: data.maxScore,
        status: data.status,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        leaderboard: data.leaderboardTitle !== undefined || data.leaderboardActive !== undefined
          ? {
              upsert: {
                create: {
                  title: data.leaderboardTitle,
                  isActive: data.leaderboardActive ?? true
                },
                update: {
                  title: data.leaderboardTitle,
                  isActive: data.leaderboardActive
                }
              }
            }
          : undefined
      },
      include: { leaderboard: true }
    });
  },

  deleteByAdmin(id: string) {
    return prisma.missionTemplate.delete({ where: { id } });
  }
};
