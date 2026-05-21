'use client';

import { useMemo } from 'react';
import { useApiClient } from './AuthProvider';
import type {
  AdminMission,
  AdminUser,
  CaddyClubSummary,
  CaddyShot,
  Course,
  CreateCourseInput,
  FollowCounts,
  FollowEntry,
  FollowingFeedEntry,
  Hole,
  HoleLayoutGeometry,
  MeResponse,
  AppNotification,
  MissionHistory,
  MissionSubmitResult,
  MutualFollower,
  MyStats,
  PublicUserProfile,
  PublicUserSummary,
  TrainingMission,
  UpdateProfileInput
} from './types';
import { normalizeLayoutGeometry, resolveLayoutMappingStatus } from './holeGeometry';

type MissionResponse = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  objective: string;
  scoreLabel: string;
  scoreInputType: 'STEPPER' | 'MANUAL_NUMBER';
  scoreDirection: 'ASC' | 'DESC';
  stepperMin: number | null;
  stepperMax: number | null;
  defaultScore: number | null;
  maxScore: number | null;
  endsAt: string | null;
  leaderboardEntries: Array<{ id: string; userId: string; playerName: string; score: number; submittedAt: string }>;
};

const mapMission = (m: MissionResponse): TrainingMission => ({
  id: m.id,
  title: m.name,
  symbol: m.icon,
  description: m.description,
  objective: m.objective,
  scoreLabel: m.scoreLabel,
  scoreInputType: m.scoreInputType === 'MANUAL_NUMBER' ? 'manual' : 'stepper',
  scoreDirection: m.scoreDirection ?? 'DESC',
  defaultScore: m.defaultScore ?? 0,
  stepperMin: m.stepperMin ?? 0,
  stepperMax: m.stepperMax ?? 10,
  maxScore: m.maxScore ?? null,
  endsAt: m.endsAt ?? null,
  leaderboard: m.leaderboardEntries.map((e) => ({
    id: e.id,
    userId: e.userId,
    playerName: e.playerName,
    score: e.score,
    submittedAt: e.submittedAt
  }))
});

type CourseRemote = {
  id: string;
  clubName: string;
  courseName: string;
  teeName: string | null;
  holeCount: 9 | 18;
  createdAt: string | Date;
  updatedAt: string | Date;
  source?: string;
  isDraft?: boolean;
  localOnly?: boolean;
  syncStatus?: string;
  holes?: Array<{
    id: string;
    holeNumber: number;
    par: number | null;
    length: number | null;
    hcpIndex: number | null;
    createdAt: string | Date;
    updatedAt: string | Date;
    layout?: {
      id?: string;
      geometry?: unknown;
      mappingStatus?: string;
      derived?: unknown;
      createdAt?: string;
      updatedAt?: string;
    } | null;
  }>;
};

const toIso = (v: string | Date) => (typeof v === 'string' ? v : new Date(v).toISOString());

const toCourse = (c: CourseRemote): Course => ({
  id: c.id,
  clubName: c.clubName,
  courseName: c.courseName,
  teeName: c.teeName ?? null,
  holeCount: c.holeCount,
  createdAt: toIso(c.createdAt),
  updatedAt: toIso(c.updatedAt),
  source: (String(c.source ?? 'manual').toLowerCase() as Course['source']),
  isDraft: Boolean(c.isDraft),
  localOnly: Boolean(c.localOnly),
  syncStatus: (String(c.syncStatus ?? 'synced').toLowerCase() as Course['syncStatus'])
});

export function useProfileApi() {
  const client = useApiClient();
  return useMemo(
    () => ({
      getMe: () => client.request<MeResponse>('/users/me'),
      updateMe: (payload: UpdateProfileInput) =>
        client.request<MeResponse>('/users/me', { method: 'PATCH', body: JSON.stringify(payload) }),
      getMyStats: () => client.request<MyStats>('/users/me/stats')
    }),
    [client]
  );
}

export function useTrainingApi() {
  const client = useApiClient();
  return useMemo(
    () => ({
      listMissions: async () => {
        const list = await client.request<MissionResponse[]>('/missions');
        return list.map(mapMission);
      },
      getMissionById: async (id: string) => mapMission(await client.request<MissionResponse>(`/missions/${id}`)),
      submitEntry: (id: string, payload: { score: number; notes?: string }) =>
        client.request<MissionSubmitResult>(`/missions/${id}/entries`, {
          method: 'POST',
          body: JSON.stringify(payload)
        }),
      getMyHistory: (id: string) => client.request<MissionHistory>(`/missions/${id}/my-history`)
    }),
    [client]
  );
}

export function useCaddyApi() {
  const client = useApiClient();
  return useMemo(
    () => ({
      listClubSummaries: async () => {
        const r = await client.request<{ items: CaddyClubSummary[] }>('/caddy/clubs');
        return r.items;
      },
      listShotsForClub: async (clubKey: string) => {
        const r = await client.request<{ shots: CaddyShot[] }>(`/caddy/clubs/${clubKey}/shots`);
        return r.shots;
      },
      addShot: (clubKey: string, payload: { distanceMeters: number; lateralOffsetMeters: number; peakHeightMeters?: number; spinRpm?: number }) =>
        client.request<CaddyShot>(`/caddy/clubs/${clubKey}/shots`, { method: 'POST', body: JSON.stringify(payload) }),
      removeShot: (shotId: string) =>
        client.request<null>(`/caddy/shots/${shotId}`, { method: 'DELETE' })
    }),
    [client]
  );
}

export function useAdminApi() {
  const client = useApiClient();
  return useMemo(
    () => ({
      listUsers: () => client.request<AdminUser[]>('/users'),
      updateUser: (userId: string, payload: Partial<AdminUser> & { displayName?: string | null; city?: string | null; country?: string | null; homeClub?: string | null }) =>
        client.request<AdminUser>(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
      listMissions: () => client.request<AdminMission[]>('/missions/admin/all'),
      createMission: (payload: Record<string, unknown>) =>
        client.request<AdminMission>('/missions/admin/all', { method: 'POST', body: JSON.stringify(payload) }),
      updateMission: (id: string, payload: Record<string, unknown>) =>
        client.request<AdminMission>(`/missions/admin/all/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
      deleteMission: (id: string) => client.request<null>(`/missions/admin/all/${id}`, { method: 'DELETE' })
    }),
    [client]
  );
}

export type CourseDetail = {
  course: Course;
  holes: (Hole & { layout: { id: string; holeId: string; geometry: HoleLayoutGeometry; mappingStatus: ReturnType<typeof resolveLayoutMappingStatus> } | null })[];
};

export function useCoursesApi() {
  const client = useApiClient();
  return useMemo(
    () => ({
      listCourses: async (search: string): Promise<Course[]> => {
        const q = search.trim();
        const suffix = q ? `?search=${encodeURIComponent(q)}` : '';
        const list = await client.request<CourseRemote[]>(`/courses${suffix}`);
        return list.map(toCourse).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      },
      createCourse: async (input: CreateCourseInput): Promise<Course> => {
        const created = await client.request<CourseRemote>('/courses', {
          method: 'POST',
          body: JSON.stringify({
            clubName: input.clubName.trim(),
            courseName: input.courseName.trim(),
            teeName: input.teeName?.trim() || null,
            holeCount: input.holeCount
          })
        });
        await client.request(`/courses/${created.id}/holes`, {
          method: 'POST',
          body: JSON.stringify({ holeCount: input.holeCount })
        });
        return toCourse(created);
      },
      updateCourse: async (courseId: string, input: Partial<CreateCourseInput>): Promise<Course> => {
        const updated = await client.request<CourseRemote>(`/courses/${courseId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            clubName: input.clubName?.trim(),
            courseName: input.courseName?.trim(),
            teeName: input.teeName?.trim() || null,
            holeCount: input.holeCount
          })
        });
        return toCourse(updated);
      },
      ensureHoles: async (courseId: string, holeCount: 9 | 18) => {
        await client.request(`/courses/${courseId}/holes`, {
          method: 'POST',
          body: JSON.stringify({ holeCount })
        });
      },
      getCourseDetail: async (courseId: string): Promise<CourseDetail | null> => {
        const data = await client.request<CourseRemote>(`/courses/${courseId}`);
        if (!data) return null;
        const course = toCourse(data);
        const holes = (data.holes ?? [])
          .sort((a, b) => a.holeNumber - b.holeNumber)
          .map((hole) => {
            const geometry = normalizeLayoutGeometry(hole.layout?.geometry ?? {});
            return {
              id: hole.id,
              courseId,
              holeNumber: hole.holeNumber,
              par: hole.par ?? null,
              length: hole.length ?? null,
              hcpIndex: hole.hcpIndex ?? null,
              createdAt: toIso(hole.createdAt),
              updatedAt: toIso(hole.updatedAt),
              layout: hole.layout
                ? {
                    id: hole.layout.id ?? `${hole.id}-layout`,
                    holeId: hole.id,
                    geometry,
                    mappingStatus: resolveLayoutMappingStatus(geometry)
                  }
                : null
            };
          });
        return { course, holes };
      },
      updateHoleMeta: async (
        courseId: string,
        holeNumber: number,
        payload: { par: number | null; length: number | null; hcpIndex: number | null }
      ) => {
        return client.request(`/courses/${courseId}/holes/${holeNumber}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      },
      updateHoleLayout: async (courseId: string, holeNumber: number, geometry: HoleLayoutGeometry) => {
        return client.request(`/courses/${courseId}/holes/${holeNumber}/layout`, {
          method: 'PATCH',
          body: JSON.stringify({ geometry })
        });
      }
    }),
    [client]
  );
}

// === Rounds (backend-persisted) ===

export type ServerRoundFormat =
  | 'STROKE_PLAY'
  | 'STABLEFORD'
  | 'BEST_BALL_TEAM'
  | 'BEST_BALL_2V2'
  | 'FFA_STROKE'
  | 'FFA_STABLEFORD'
  | 'WOLF';

export type ServerWolfRole = 'WOLF' | 'PARTNER' | 'OPPONENT';

export type ServerRound = {
  id: string;
  userId: string;
  courseId: string;
  startedAt: string;
  finishedAt: string | null;
  currentHoleNumber: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  format: ServerRoundFormat;
  teeNameSnapshot: string | null;
  courseNameSnapshot: string;
  clubNameSnapshot: string;
  totalScore: number | null;
};

export type ServerRoundHoleScore = {
  id: string;
  roundHoleId: string;
  playerId: string;
  strokes: number | null;
  wolfRole: ServerWolfRole | null;
};

export type ServerRoundHole = {
  id: string;
  roundId: string;
  holeId: string;
  holeNumber: number;
  strokes: number | null;
  parSnapshot: number | null;
  lengthSnapshot: number | null;
  hcpIndexSnapshot: number | null;
  notes: string | null;
  completedAt: string | null;
  scores?: ServerRoundHoleScore[];
};

export type ServerRoundPlayer = {
  id: string;
  roundId: string;
  userId: string;
  displayNameSnapshot: string;
  team: string | null;
  order: number;
};

export type ServerRoundDetail = ServerRound & {
  roundHoles: ServerRoundHole[];
  players: ServerRoundPlayer[];
};

export type CreateRoundPayload = {
  courseId: string;
  format?: ServerRoundFormat;
  players?: Array<{ userId: string; team?: string | null }>;
};

export function useRoundsApi() {
  const client = useApiClient();
  return useMemo(
    () => ({
      list: (status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED') => {
        const qs = status ? `?status=${status}` : '';
        return client.request<ServerRound[]>(`/rounds${qs}`);
      },
      create: (payload: CreateRoundPayload) =>
        client.request<ServerRoundDetail>('/rounds', {
          method: 'POST',
          body: JSON.stringify(payload)
        }),
      getById: (roundId: string) => client.request<ServerRoundDetail>(`/rounds/${roundId}`),
      update: (roundId: string, patch: { currentHoleNumber?: number; status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' }) =>
        client.request<ServerRoundDetail>(`/rounds/${roundId}`, {
          method: 'PATCH',
          body: JSON.stringify(patch)
        }),
      updateHole: (
        roundId: string,
        holeNumber: number,
        patch: { strokes?: number | null; notes?: string | null }
      ) =>
        client.request<ServerRoundHole>(`/rounds/${roundId}/holes/${holeNumber}`, {
          method: 'PATCH',
          body: JSON.stringify(patch)
        }),
      remove: (roundId: string) => client.request<null>(`/rounds/${roundId}`, { method: 'DELETE' }),
      updatePlayerScore: (
        roundId: string,
        holeNumber: number,
        playerId: string,
        patch: { strokes?: number | null; wolfRole?: ServerWolfRole | null }
      ) =>
        client.request<ServerRoundHoleScore>(
          `/rounds/${roundId}/holes/${holeNumber}/scores/${playerId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(patch)
          }
        )
    }),
    [client]
  );
}

export function useUsersApi() {
  const client = useApiClient();
  return useMemo(
    () => ({
      search: (q: string, limit = 20) =>
        client.request<PublicUserSummary[]>(`/users/search?q=${encodeURIComponent(q)}&limit=${limit}`),
      getPublicProfile: (userId: string) =>
        client.request<PublicUserProfile>(`/users/profiles/${userId}`)
    }),
    [client]
  );
}

export function usePushApi() {
  const client = useApiClient();
  return useMemo(
    () => ({
      getVapidPublicKey: () => client.request<{ publicKey: string }>('/push/vapid-public-key'),
      subscribe: (endpoint: string, p256dh: string, auth: string) =>
        client.request<{ ok: boolean }>('/push/subscribe', {
          method: 'POST',
          body: JSON.stringify({ endpoint, keys: { p256dh, auth } })
        }),
      unsubscribe: (endpoint: string) =>
        client.request<null>('/push/subscribe', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint })
        })
    }),
    [client]
  );
}

export function useFollowsApi() {
  const client = useApiClient();
  return useMemo(
    () => ({
      follow: (targetUserId: string) =>
        client.request<{ id: string }>(`/follows/${targetUserId}`, { method: 'POST' }),
      unfollow: (targetUserId: string) =>
        client.request<null>(`/follows/${targetUserId}`, { method: 'DELETE' }),
      isFollowing: (targetUserId: string) =>
        client.request<{ isFollowing: boolean }>(`/follows/${targetUserId}/status`),
      listFollowers: (userId: string, limit = 50, offset = 0) =>
        client.request<FollowEntry[]>(`/follows/profiles/${userId}/followers?limit=${limit}&offset=${offset}`),
      listFollowing: (userId: string, limit = 50, offset = 0) =>
        client.request<FollowEntry[]>(`/follows/profiles/${userId}/following?limit=${limit}&offset=${offset}`),
      getCounts: (userId: string) =>
        client.request<FollowCounts>(`/follows/profiles/${userId}/counts`),
      getFollowingFeed: (limit = 5, offset = 0) =>
        client.request<FollowingFeedEntry[]>(`/follows/feed/following-rounds?limit=${limit}&offset=${offset}`),
      listMutualFollowers: () => client.request<MutualFollower[]>('/follows/mutual')
    }),
    [client]
  );
}

export function useNotificationsApi() {
  const client = useApiClient();
  return useMemo(
    () => ({
      list: (opts: { unreadOnly?: boolean; limit?: number; offset?: number } = {}) => {
        const qs = new URLSearchParams();
        if (opts.unreadOnly) qs.set('unreadOnly', 'true');
        if (opts.limit !== undefined) qs.set('limit', String(opts.limit));
        if (opts.offset !== undefined) qs.set('offset', String(opts.offset));
        const tail = qs.toString();
        return client.request<AppNotification[]>(`/notifications${tail ? `?${tail}` : ''}`);
      },
      unreadCount: () => client.request<{ count: number }>('/notifications/unread-count'),
      markRead: (notificationId: string) =>
        client.request<null>(`/notifications/${notificationId}/read`, { method: 'POST' }),
      markAllRead: () => client.request<null>('/notifications/read-all', { method: 'POST' })
    }),
    [client]
  );
}
