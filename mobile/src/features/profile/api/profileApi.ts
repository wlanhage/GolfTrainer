import { ApiClient } from '../../../shared/api/apiClient';
import { useAuth } from '../../../shared/store/authStore';
import { MeResponse } from '../types/profile';

export function useProfileApi() {
  const { getValidAccessToken, refreshSession } = useAuth();
  const client = new ApiClient({
    getAccessToken: getValidAccessToken,
    onUnauthorized: refreshSession
  });

  return {
    getMe: () => client.request<MeResponse>('/users/me')
  };
}
