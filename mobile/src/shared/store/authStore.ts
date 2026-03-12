import { createContext, useContext } from 'react';
import { MeResponse } from '../../features/profile/types/profile';

export type AuthStateStatus = 'loading' | 'authenticated' | 'guest';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthStoreValue = {
  status: AuthStateStatus;
  tokens: AuthTokens | null;
  me: MeResponse | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  getValidAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<string | null>;
  reloadMe: () => Promise<void>;
};

export const AuthContext = createContext<AuthStoreValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
