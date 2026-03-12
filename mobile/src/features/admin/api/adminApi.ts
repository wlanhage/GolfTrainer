import { useMemo } from 'react';
import { ApiClient } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/authStore';
import { AdminDrill, AdminUser } from '../types/admin';

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
      listDrills: () => client.request<AdminDrill[]>('/drills/admin/all'),
      createDrill: (payload: {
        name: string;
        description?: string;
        metricType: AdminDrill['metricType'];
        isPublic?: boolean;
      }) =>
        client.request<AdminDrill>('/drills/admin/all', {
          method: 'POST',
          body: JSON.stringify(payload)
        }),
      updateDrill: (drillId: string, payload: Partial<Pick<AdminDrill, 'name' | 'description' | 'metricType' | 'isPublic'>>) =>
        client.request<AdminDrill>(`/drills/admin/all/${drillId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        }),
      deleteDrill: (drillId: string) =>
        client.request<null>(`/drills/admin/all/${drillId}`, {
          method: 'DELETE'
        })
    }),
    [client]
  );
}
