import { useMemo } from 'react';
import { ApiClient } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/authStore';
import { AdminMission, AdminUser } from '../types/admin';

export function useAdminApi() {
  const { getValidAccessToken, refreshSession } = useAuth();

  const client = useMemo(
    () =>
      new ApiClient({
        getAccessToken: getValidAccessToken,
        onUnauthorized: refreshSession
      }),
    [getValidAccessToken, refreshSession]
  );

  return useMemo(
    () => ({
      listUsers: () => client.request<AdminUser[]>('/users'),
      updateUser: (userId: string, payload: Partial<AdminUser> & { displayName?: string | null; city?: string | null; country?: string | null; homeClub?: string | null }) =>
        client.request<AdminUser>(`/users/${userId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        }),
      listMissions: () => client.request<AdminMission[]>('/missions/admin/all'),
      createMission: (payload: Partial<Omit<AdminMission, 'id' | 'leaderboard'>> & { leaderboardTitle?: string; leaderboardActive?: boolean }) =>
        client.request<AdminMission>('/missions/admin/all', {
          method: 'POST',
          body: JSON.stringify(payload)
        }),
      updateMission: (missionId: string, payload: Partial<Omit<AdminMission, 'id' | 'leaderboard'>> & { leaderboardTitle?: string; leaderboardActive?: boolean }) =>
        client.request<AdminMission>(`/missions/admin/all/${missionId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        }),
      deleteMission: (missionId: string) =>
        client.request<null>(`/missions/admin/all/${missionId}`, {
          method: 'DELETE'
        })
    }),
    [client]
  );
}
