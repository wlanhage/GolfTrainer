import { caddyClubs } from './caddyClubs';

const ENABLED_KEY = 'shotTracking.enabled';
const CLUBS_KEY = 'shotTracking.clubs';

export const shotTrackingStore = {
  isEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ENABLED_KEY) === 'true';
  },

  setEnabled(enabled: boolean): void {
    localStorage.setItem(ENABLED_KEY, String(enabled));
    // If enabling for the first time and no clubs selected, select all
    if (enabled && !localStorage.getItem(CLUBS_KEY)) {
      localStorage.setItem(CLUBS_KEY, JSON.stringify(caddyClubs.map(c => c.id)));
    }
  },

  getSelectedClubs(): string[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(CLUBS_KEY);
    if (!stored) return caddyClubs.map(c => c.id);
    try {
      return JSON.parse(stored) as string[];
    } catch {
      return caddyClubs.map(c => c.id);
    }
  },

  setSelectedClubs(clubIds: string[]): void {
    localStorage.setItem(CLUBS_KEY, JSON.stringify(clubIds));
  },

  toggleClub(clubId: string): void {
    const current = shotTrackingStore.getSelectedClubs();
    const idx = current.indexOf(clubId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(clubId);
    }
    shotTrackingStore.setSelectedClubs(current);
  }
};
