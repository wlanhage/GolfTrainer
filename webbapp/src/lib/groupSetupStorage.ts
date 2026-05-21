export const GROUP_SETUP_STORAGE_KEY = 'golftrainer.play.groupSetup';

export type GroupSetup = {
  courseId: string;
  invitedUserIds: string[];
};

export const loadGroupSetup = (): GroupSetup | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(GROUP_SETUP_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GroupSetup;
  } catch {
    return null;
  }
};

export const saveGroupSetup = (setup: GroupSetup) => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(GROUP_SETUP_STORAGE_KEY, JSON.stringify(setup));
};

export const clearGroupSetup = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(GROUP_SETUP_STORAGE_KEY);
};
