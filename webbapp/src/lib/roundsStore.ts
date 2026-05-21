'use client';

// Backend-driven round-store. Anropar /api/v1/rounds via useRoundsApi.
// Inget localStorage längre — backend är source of truth, alla devices
// ser samma data, leaderboards och activity-feed kan fungera.

import { useMemo } from 'react';
import { useAuth } from './AuthProvider';
import {
  useRoundsApi,
  type CreateRoundPayload,
  type ServerRound,
  type ServerRoundDetail,
  type ServerRoundHole
} from './api';
import type {
  HoleLayoutGeometry,
  InProgressRoundSummary,
  Round,
  RoundOverview,
  RoundOverviewItem
} from './types';
import { resolveLayoutMappingStatus } from './holeGeometry';

export type LatestRoundSummary = {
  roundId: string;
  courseId: string;
  courseName: string;
  clubName: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'completed' | 'abandoned';
  totalScore: number;
  totalPar: number;
  relativeToPar: number | null;
  completedHoles: number;
  totalHoles: number;
};

const toInProgressSummary = (r: ServerRound): InProgressRoundSummary => ({
  roundId: r.id,
  courseId: r.courseId,
  courseName: r.courseNameSnapshot,
  clubName: r.clubNameSnapshot,
  currentHoleNumber: r.currentHoleNumber,
  startedAt: r.startedAt
});

const detailToLatest = (detail: ServerRoundDetail): LatestRoundSummary => {
  const totalScore = detail.roundHoles.reduce((s, h) => s + (h.strokes ?? 0), 0);
  const totalPar = detail.roundHoles.reduce((s, h) => s + (h.parSnapshot ?? 0), 0);
  const completedHoles = detail.roundHoles.filter((h) => h.strokes !== null).length;
  return {
    roundId: detail.id,
    courseId: detail.courseId,
    courseName: detail.courseNameSnapshot,
    clubName: detail.clubNameSnapshot,
    startedAt: detail.startedAt,
    finishedAt: detail.finishedAt,
    status: detail.status === 'COMPLETED' ? 'completed' : 'abandoned',
    totalScore,
    totalPar,
    relativeToPar: totalPar === 0 ? null : totalScore - totalPar,
    completedHoles,
    totalHoles: detail.roundHoles.length
  };
};

export type GetRoundResult = {
  round: Round;
  roundHoles: ServerRoundHole[];
  players: ServerRoundDetail['players'];
};

const detailToRound = (detail: ServerRoundDetail): GetRoundResult => ({
  round: {
    id: detail.id,
    courseId: detail.courseId,
    startedAt: detail.startedAt,
    finishedAt: detail.finishedAt,
    currentHoleNumber: detail.currentHoleNumber,
    status: detail.status.toLowerCase() as 'in_progress' | 'completed' | 'abandoned',
    format: detail.format ?? 'STROKE_PLAY',
    teeNameSnapshot: detail.teeNameSnapshot,
    courseNameSnapshot: detail.courseNameSnapshot,
    clubNameSnapshot: detail.clubNameSnapshot
  },
  roundHoles: detail.roundHoles,
  players: detail.players ?? []
});

export type RoundsStore = {
  ready: boolean;
  listInProgress: () => Promise<InProgressRoundSummary[]>;
  startRound: (payload: CreateRoundPayload) => Promise<{ id: string; currentHoleNumber: number }>;
  getRound: (roundId: string) => Promise<GetRoundResult | null>;
  saveScore: (roundId: string, holeNumber: number, strokes: number | null) => Promise<void>;
  setCurrentHole: (roundId: string, holeNumber: number) => Promise<void>;
  completeRound: (roundId: string) => Promise<void>;
  abandonRound: (roundId: string, action: 'save' | 'delete') => Promise<void>;
  getOverview: (roundId: string, layoutByHoleId: Map<string, HoleLayoutGeometry>) => Promise<RoundOverview | null>;
  getLatestFinished: () => Promise<LatestRoundSummary | null>;
  getBestFinished: () => Promise<LatestRoundSummary | null>;
};

export function useRoundsStore(): RoundsStore {
  const { me } = useAuth();
  const api = useRoundsApi();
  const ready = Boolean(me?.id);

  return useMemo<RoundsStore>(() => {
    if (!ready) {
      return {
        ready: false,
        listInProgress: async () => [],
        startRound: async () => {
          throw new Error('Ingen användare inloggad.');
        },
        getRound: async () => null,
        saveScore: async () => undefined,
        setCurrentHole: async () => undefined,
        completeRound: async () => undefined,
        abandonRound: async () => undefined,
        getOverview: async () => null,
        getLatestFinished: async () => null,
        getBestFinished: async () => null
      };
    }

    return {
      ready: true,

      async listInProgress() {
        const list = await api.list('IN_PROGRESS');
        return list.map(toInProgressSummary);
      },

      async startRound(payload) {
        const detail = await api.create(payload);
        return { id: detail.id, currentHoleNumber: detail.currentHoleNumber };
      },

      async getRound(roundId: string) {
        try {
          const detail = await api.getById(roundId);
          return detailToRound(detail);
        } catch {
          return null;
        }
      },

      async saveScore(roundId, holeNumber, strokes) {
        await api.updateHole(roundId, holeNumber, { strokes });
      },

      async setCurrentHole(roundId, holeNumber) {
        await api.update(roundId, { currentHoleNumber: holeNumber });
      },

      async completeRound(roundId) {
        await api.update(roundId, { status: 'COMPLETED' });
      },

      async abandonRound(roundId, action) {
        if (action === 'delete') {
          await api.remove(roundId);
        } else {
          await api.update(roundId, { status: 'ABANDONED' });
        }
      },

      async getOverview(roundId, layoutByHoleId) {
        let detail: ServerRoundDetail;
        try {
          detail = await api.getById(roundId);
        } catch {
          return null;
        }
        const items: RoundOverviewItem[] = detail.roundHoles.map((rh) => {
          const geometry = layoutByHoleId.get(rh.holeId);
          const layoutStatus = geometry ? resolveLayoutMappingStatus(geometry) : 'not_started';
          const scoreStatus: 'missing' | 'done' = rh.strokes === null ? 'missing' : 'done';
          const metadataStatus: 'missing' | 'done' =
            rh.parSnapshot === null || rh.lengthSnapshot === null || rh.hcpIndexSnapshot === null ? 'missing' : 'done';
          return {
            holeNumber: rh.holeNumber,
            par: rh.parSnapshot,
            length: rh.lengthSnapshot,
            hcpIndex: rh.hcpIndexSnapshot,
            strokes: rh.strokes,
            scoreStatus,
            metadataStatus,
            layoutStatus
          };
        });
        const totalScore = detail.roundHoles.reduce((s, h) => s + (h.strokes ?? 0), 0);
        const totalPar = detail.roundHoles.reduce((s, h) => s + (h.parSnapshot ?? 0), 0);
        return {
          round: {
            id: detail.id,
            courseId: detail.courseId,
            startedAt: detail.startedAt,
            finishedAt: detail.finishedAt,
            currentHoleNumber: detail.currentHoleNumber,
            status: detail.status.toLowerCase() as 'in_progress' | 'completed' | 'abandoned',
            format: detail.format ?? 'STROKE_PLAY',
            teeNameSnapshot: detail.teeNameSnapshot,
            courseNameSnapshot: detail.courseNameSnapshot,
            clubNameSnapshot: detail.clubNameSnapshot
          },
          items,
          totalScore,
          totalPar,
          relativeToPar: totalPar === 0 ? null : totalScore - totalPar,
          completedHoles: detail.roundHoles.filter((h) => h.strokes !== null).length
        };
      },

      async getLatestFinished() {
        const [completed, abandoned] = await Promise.all([api.list('COMPLETED'), api.list('ABANDONED')]);
        const finished = [...completed, ...abandoned].sort((a, b) =>
          (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt)
        );
        const first = finished[0];
        if (!first) return null;
        const detail = await api.getById(first.id);
        return detailToLatest(detail);
      },

      async getBestFinished() {
        const completed = await api.list('COMPLETED');
        if (completed.length === 0) return null;
        const details = await Promise.all(completed.map((r) => api.getById(r.id)));
        const summaries = details.map(detailToLatest);
        summaries.sort((a, b) => {
          const ra = a.relativeToPar;
          const rb = b.relativeToPar;
          if (ra !== null && rb !== null) return ra - rb;
          if (ra !== null) return -1;
          if (rb !== null) return 1;
          return a.totalScore - b.totalScore;
        });
        return summaries[0] ?? null;
      }
    };
  }, [api, ready]);
}
