import { useMemo } from 'react';
import { ApiClient } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/authStore';
import { CaddyClubSummary, CaddyShot } from '../types/caddy';

export function useCaddyApi() {
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
      listClubSummaries: async () => {
        const response = await client.request<{ items: CaddyClubSummary[] }>('/caddy/clubs');
        return response.items;
      },
      listShotsForClub: async (clubKey: string) => {
        const response = await client.request<{ shots: CaddyShot[] }>(`/caddy/clubs/${clubKey}/shots`);
        return response.shots;
      },
      addShot: (clubKey: string, payload: {
        distanceMeters: number;
        lateralOffsetMeters: number;
        peakHeightMeters?: number;
        spinRpm?: number;
      }) =>
        client.request<CaddyShot>(`/caddy/clubs/${clubKey}/shots`, {
          method: 'POST',
          body: JSON.stringify(payload)
        }),
      removeShot: (shotId: string) =>
        client.request<null>(`/caddy/shots/${shotId}`, {
          method: 'DELETE'
        })
    }),
    [client]
  );
}
