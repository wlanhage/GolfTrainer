import { useCallback, useEffect, useState } from 'react';
import { useProfileApi } from '../api/profileApi';
import type { MeResponse, UpdateProfileInput } from '../types/profile';

export function useProfile() {
  const { getMe, updateMe } = useProfileApi();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await getMe());
    } catch {
      setError('Kunde inte hämta profil.');
    } finally {
      setLoading(false);
    }
  }, [getMe]);

  const saveField = useCallback(
    async (field: keyof UpdateProfileInput, rawValue: string) => {
      const cleanValue = rawValue.trim();
      const numericFields = ['handicap', 'targetHandicap', 'yearsPlaying', 'roundsLast12Months', 'trainingDaysPerWeek'];
      const parsedValue =
        cleanValue === ''
          ? null
          : field === 'dominantHand'
            ? cleanValue.toUpperCase() === 'LEFT'
              ? 'LEFT'
              : 'RIGHT'
            : numericFields.includes(field as string)
              ? Number(cleanValue)
              : cleanValue;

      if (typeof parsedValue === 'number' && Number.isNaN(parsedValue)) {
        throw new Error('Ogiltigt nummer.');
      }

      setSavingField(field as string);
      setError(null);
      try {
        const updated = await updateMe({ [field]: parsedValue } as UpdateProfileInput);
        setProfile(updated);
      } catch {
        setError('Kunde inte spara ändringen.');
        throw new Error('Save failed');
      } finally {
        setSavingField(null);
      }
    },
    [updateMe]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { profile, loading, error, savingField, reload: load, saveField };
}
