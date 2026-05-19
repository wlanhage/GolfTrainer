'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useFollowsApi, useProfileApi } from '@/lib/api';
import { useRoundsStore, type LatestRoundSummary } from '@/lib/roundsStore';
import { formatDate } from '@/lib/format';
import { Skeleton } from '@/components/Skeleton';
import { UserAvatar } from '@/components/UserAvatar';
import { AvatarUpload } from '@/components/AvatarUpload';
import { useT } from '@/lib/i18n/I18nProvider';
import type { DominantHand, FollowCounts, MeResponse, MyStats, UpdateProfileInput } from '@/lib/types';

function StatTile({
  label,
  value,
  hint
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-primary-softer border border-border rounded-xl p-3 flex flex-col gap-0.5">
      <div className="text-[10px] uppercase tracking-wider font-bold text-primary">{label}</div>
      <div className="text-xl font-extrabold text-ink leading-tight truncate">{value}</div>
      {hint ? <div className="text-[10px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

function TextRow({
  label,
  value,
  placeholder,
  saving,
  numeric,
  onSave
}: {
  label: string;
  value: string;
  placeholder?: string;
  saving: boolean;
  numeric?: boolean;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const t = useT();

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  const commit = async () => {
    if (draft.trim() === value.trim()) {
      setEditing(false);
      return;
    }
    await onSave(draft);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-b-0">
      <span className="text-sm text-slate-600 flex-shrink-0 w-32">{label}</span>
      {editing ? (
        <div className="flex-1 flex items-center gap-1.5">
          <input
            autoFocus
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commit();
              else if (e.key === 'Escape') {
                setDraft(value);
                setEditing(false);
              }
            }}
            inputMode={numeric ? 'decimal' : undefined}
            type={numeric ? 'number' : 'text'}
            placeholder={placeholder}
            className="flex-1 border-2 border-primary rounded-md px-2 py-1.5 font-semibold text-right focus:outline-none"
          />
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="flex-1 text-right text-ink font-semibold py-1">
          {value || <span className="text-slate-400 italic font-normal">{t('profile.tapToAdd')}</span>}
        </button>
      )}
    </div>
  );
}

function DominantHandRow({
  value,
  saving,
  onSave
}: {
  value: DominantHand;
  saving: boolean;
  onSave: (next: DominantHand) => Promise<void>;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-b-0">
      <span className="text-sm text-slate-600 flex-shrink-0 w-32">{t('profile.hand')}</span>
      <div className="flex-1 flex items-center justify-end gap-2">
        {(['RIGHT', 'LEFT'] as const).map((hand) => {
          const active = (value ?? 'RIGHT') === hand;
          return (
            <button
              key={hand}
              disabled={saving}
              onClick={() => void onSave(hand)}
              className={`rounded-lg px-3 py-1.5 font-bold text-sm border-2 transition ${
                active ? 'bg-primary border-primary text-white' : 'bg-white text-primary border-primary'
              }`}
            >
              {hand === 'RIGHT' ? t('profile.right') : t('profile.left')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const formatRel = (r: LatestRoundSummary | null) => {
  if (!r) return '-';
  if (r.relativeToPar === null) return `${r.totalScore}`;
  const sign = r.relativeToPar > 0 ? '+' : '';
  return `${sign}${r.relativeToPar}`;
};

export default function ProfilePage() {
  const { logout } = useAuth();
  const api = useProfileApi();
  const followsApi = useFollowsApi();
  const roundsStore = useRoundsStore();
  const t = useT();

  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [counts, setCounts] = useState<FollowCounts | null>(null);
  const [bestRound, setBestRound] = useState<LatestRoundSummary | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await api.getMe();
      setProfile(me);
      if (me?.id) {
        Promise.all([
          followsApi.getCounts(me.id).then(setCounts).catch(() => undefined),
          api.getMyStats().then(setStats).catch(() => setStats(null))
        ]);
      }
      if (roundsStore.ready) {
        roundsStore.getBestFinished().then(setBestRound).catch(() => setBestRound(null));
      }
    } catch {
      setError(t('profile.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [api, followsApi, roundsStore, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveField = async (field: keyof UpdateProfileInput, rawValue: string | number | DominantHand) => {
    let parsed: string | number | null = rawValue as string | number | null;
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (trimmed === '') parsed = null;
      else if (field === 'handicap') {
        const n = Number(trimmed);
        if (!Number.isFinite(n)) throw new Error('Ogiltigt nummer');
        parsed = n;
      } else parsed = trimmed;
    }
    setSavingField(field);
    try {
      const updated = await api.updateMe({ [field]: parsed } as UpdateProfileInput);
      setProfile(updated);
    } finally {
      setSavingField(null);
    }
  };

  const pData = profile?.profile;

  if (loading) {
    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Skeleton rounded="full" className="w-20 h-20" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-20" rounded="xl" />
          <Skeleton className="h-20" rounded="xl" />
          <Skeleton className="h-20" rounded="xl" />
          <Skeleton className="h-20" rounded="xl" />
        </div>
        <Skeleton className="h-48" rounded="xl" />
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 pb-8">
      {/* Hero: avatar + display name */}
      <section className="flex items-center gap-3">
        <AvatarUpload
          currentAvatar={pData?.avatarImage}
          displayName={pData?.displayName}
          email={profile?.email}
          size={80}
          onUpload={(dataUrl) => saveField('avatarImage', dataUrl)}
          onRemove={() => saveField('avatarImage', '')}
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold text-ink truncate">{pData?.displayName ?? profile?.email ?? ''}</h1>
          <p className="text-sm text-slate-500 truncate">{profile?.email}</p>
          {stats?.memberSince ? (
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t('profile.memberSince')} {formatDate(stats.memberSince)}
            </p>
          ) : null}
        </div>
      </section>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      {/* Followers/following + sök */}
      {profile?.id ? (
        <div className="flex items-center justify-center gap-6">
          <Link href={`/u/${profile.id}/followers`} className="text-center">
            <div className="text-xl font-extrabold text-ink">{counts?.followerCount ?? 0}</div>
            <div className="text-xs text-slate-600">{t('profile.followers')}</div>
          </Link>
          <Link href={`/u/${profile.id}/following`} className="text-center">
            <div className="text-xl font-extrabold text-ink">{counts?.followingCount ?? 0}</div>
            <div className="text-xs text-slate-600">{t('profile.following')}</div>
          </Link>
          <Link href="/community" className="bg-primary text-white font-bold rounded-lg px-3 py-2 text-sm" aria-label={t('common.search')}>
            🔍 {t('common.search')}
          </Link>
        </div>
      ) : null}

      {/* Stats grid */}
      <section className="grid grid-cols-2 gap-2">
        <StatTile
          label={t('profile.hcp')}
          value={pData?.handicap !== null && pData?.handicap !== undefined ? pData.handicap : '-'}
        />
        <StatTile
          label={t('profile.bestRound')}
          value={bestRound ? formatRel(bestRound) : '-'}
          hint={bestRound ? bestRound.courseName : t('profile.playARound')}
        />
        <StatTile
          label={t('profile.longestDrive')}
          value={stats?.longestDriveMeters ? `${Math.round(stats.longestDriveMeters)} m` : '-'}
          hint={t('profile.fromCaddyData')}
        />
        <StatTile
          label={t('profile.favoriteClub')}
          value={stats?.favoriteClub ?? '-'}
          hint={t('profile.mostShots')}
        />
        <StatTile
          label={t('profile.caddyShots')}
          value={stats?.totalCaddyShots ?? 0}
          hint={t('profile.totalRecorded')}
        />
        <StatTile
          label={t('profile.missions')}
          value={stats?.missionsCompleted ?? 0}
          hint={stats?.totalMissionEntries ? `${stats.totalMissionEntries} ${t('profile.attempts')}` : ''}
        />
      </section>

      {/* Editerbara fält */}
      <section className="card flex flex-col gap-0">
        <h2 className="font-bold text-base mb-1">{t('profile.myInfo')}</h2>
        <TextRow
          label={t('profile.name')}
          value={pData?.displayName ?? ''}
          placeholder=""
          saving={savingField === 'displayName'}
          onSave={(v) => saveField('displayName', v)}
        />
        <TextRow
          label={t('profile.hcp')}
          value={pData?.handicap?.toString() ?? ''}
          placeholder="12.4"
          numeric
          saving={savingField === 'handicap'}
          onSave={(v) => saveField('handicap', v)}
        />
        <TextRow
          label={t('profile.homeClub')}
          value={pData?.homeClub ?? ''}
          placeholder=""
          saving={savingField === 'homeClub'}
          onSave={(v) => saveField('homeClub', v)}
        />
        <DominantHandRow
          value={pData?.dominantHand ?? 'RIGHT'}
          saving={savingField === 'dominantHand'}
          onSave={(v) => saveField('dominantHand', v)}
        />
      </section>

      <button onClick={() => void logout()} className="btn-danger mt-2">
        {t('nav.logout')}
      </button>
    </div>
  );
}
