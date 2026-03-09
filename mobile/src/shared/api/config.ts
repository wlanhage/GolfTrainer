import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Note:
// - Android emulator cannot reach your host machine via "localhost"; use 10.0.2.2.
// - A physical phone also cannot reach your host via "localhost"; use your PC's LAN IP.
//   We try to derive it from Expo's hostUri (e.g. "192.168.0.35:8081").
function getLanHostFromExpo(): string | null {
  const hostUri =
    // Expo SDK 50+ (often)
    (Constants.expoConfig as unknown as { hostUri?: string } | undefined)?.hostUri ??
    // Fallbacks across Expo/manifest shapes
    (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2?.extra
      ?.expoClient?.hostUri ??
    (Constants as unknown as { manifest?: { hostUri?: string } }).manifest?.hostUri ??
    null;

  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host || null;
}

const HOST =
  Platform.OS === 'android'
    ? '10.0.2.2'
    : // Prefer LAN host when running on a physical device via Expo
      (getLanHostFromExpo() ?? 'localhost');

export const API_BASE_URL = `http://${HOST}:3000/api/v1`;
export const REQUEST_TIMEOUT_MS = 10000;
