'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useProfileApi } from '@/lib/api';
import { useT } from '@/lib/i18n/I18nProvider';
import type { DominantHand } from '@/lib/types';

export default function WelcomePage() {
  const router = useRouter();
  const { me, reloadMe } = useAuth();
  const api = useProfileApi();
  const t = useT();

  const [handicap, setHandicap] = useState('');
  const [homeClub, setHomeClub] = useState('');
  const [hand, setHand] = useState<DominantHand>('RIGHT');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = me?.profile?.displayName ?? me?.email ?? '';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const hcp = handicap.trim() ? Number(handicap) : null;
      if (hcp !== null && !Number.isFinite(hcp)) {
        setError(t('profile.invalidNumber'));
        setSubmitting(false);
        return;
      }
      await api.updateMe({
        handicap: hcp,
        homeClub: homeClub.trim() || null,
        dominantHand: hand,
      });
      await reloadMe();
      router.replace('/');
    } catch {
      setError(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const skip = () => {
    router.replace('/');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-5 gap-5 max-w-md mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold text-ink">{t('welcome.title')}</h1>
        <p className="text-slate-600 mt-1">
          {t('welcome.subtitle', { name: displayName })}
        </p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-slate-700">{t('profile.hcp')}</label>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="12.4"
            value={handicap}
            onChange={(e) => setHandicap(e.target.value)}
            className="input"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-slate-700">{t('profile.homeClub')}</label>
          <input
            placeholder={t('welcome.homeClubPlaceholder')}
            value={homeClub}
            onChange={(e) => setHomeClub(e.target.value)}
            className="input"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-slate-700">{t('profile.hand')}</label>
          <div className="flex gap-2">
            {(['RIGHT', 'LEFT'] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHand(h)}
                className={`flex-1 rounded-xl py-3 font-bold border-2 transition ${
                  hand === h
                    ? 'bg-primary border-primary text-white'
                    : 'bg-white text-primary border-primary'
                }`}
              >
                {h === 'RIGHT' ? t('profile.right') : t('profile.left')}
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="text-danger text-sm">{error}</p> : null}

        <button type="submit" disabled={submitting} className="btn-primary mt-2">
          {submitting ? t('common.loading') : t('welcome.continue')}
        </button>
      </form>

      <button onClick={skip} className="text-center text-slate-500 font-semibold">
        {t('welcome.skip')}
      </button>
    </div>
  );
}
