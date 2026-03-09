import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthTokens } from '../store/authStore';

const AUTH_TOKENS_KEY = 'golftrainer.auth.tokens';

export const tokenStorage = {
  async save(tokens: AuthTokens) {
    await AsyncStorage.setItem(AUTH_TOKENS_KEY, JSON.stringify(tokens));
  },

  async load(): Promise<AuthTokens | null> {
    const value = await AsyncStorage.getItem(AUTH_TOKENS_KEY);
    if (!value) return null;

    try {
      return JSON.parse(value) as AuthTokens;
    } catch {
      return null;
    }
  },

  async clear() {
    await AsyncStorage.removeItem(AUTH_TOKENS_KEY);
  }
};
