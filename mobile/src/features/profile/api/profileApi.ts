import { useMemo } from 'react';
import { ApiClient } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/authStore';
import { MeResponse, UpdateProfileInput } from '../types/profile';

export function useProfileApi() {
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
      getMe: () => client.request<MeResponse>('/users/me'),
      updateMe: (payload: UpdateProfileInput) =>
        client.request<MeResponse>('/users/me', {
          method: 'PATCH',
          body: JSON.stringify(payload)
        })
    }),
    [client]
  );
}
