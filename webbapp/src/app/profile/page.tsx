'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useFollowsApi, useProfileApi } from '@/lib/api';
import { useRoundsStore, type LatestRoundSummary } from '@/lib/roundsStore';
import { formatDate } from '@/lib/format';
import { Skeleton } from '@/components/Skeleton';
import { UserAvatar } from '@/components/UserAvatar';
import { AvatarUpload } from '@/components/AvatarUpload';
import { useT } from '@/lib/i18n/I18nProvider';
import { useToast } from '@/lib/ToastProvider';
import {
  canUsePush,
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus
} from '@/lib/push';
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

function NotificationsSection() {
  const t = useT();
  const toast = useToast();
  const [status, setStatus] = useState<PushStatus | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  const pushCheck = canUsePush();

  useEffect(() => {
    if (pushCheck.supported || pushCheck.needsInstall) {
      getPushStatus()
        .then(setStatus)
        .catch(() => setStatus('unsupported'));
    } else {
      setStatus('unsupported');
    }
  }, [pushCheck.supported, pushCheck.needsInstall]);

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (status === 'subscribed') {
        await unsubscribeFromPush();
        setStatus('available');
        toast.success(t('push.successDisabled'));
      } else {
        await subscribeToPush();
        setStatus('subscribed');
        toast.success(t('push.successEnabled'));
      }
    } catch {
      toast.error(status === 'subscribed' ? t('push.errorDisable') : t('push.errorEnable'));
    } finally {
      setBusy(false);
    }
  };

  // iOS in regular Safari tab — show install prompt
  if (pushCheck.needsInstall) {
    return (
      <section className="card flex flex-col gap-2">
        <h2 className="font-bold text-base">{t('push.sectionTitle')}</h2>
        <p className="text-sm font-semibold text-ink">{t('push.iosPromptTitle')}</p>
        <p className="text-sm text-slate-600">{t('push.iosPromptBody')}</p>
        <ol className="list-decimal list-inside flex flex-col gap-1 text-sm text-slate-600 mt-1">
          <li>{t('push.iosStep1')}</li>
          <li>{t('push.iosStep2')}</li>
          <li>{t('push.iosStep3')}</li>
        </ol>
      </section>
    );
  }

  // Unsupported environment — hide the section entirely
  if (!pushCheck.supported && !pushCheck.needsInstall) {
    return null;
  }

  const statusLabel =
    status === 'loading'
      ? t('common.loading')
      : status === 'subscribed'
        ? t('push.status.subscribed')
        : status === 'denied'
          ? t('push.status.denied')
          : status === 'available'
            ? t('push.status.available')
            : t('push.status.unsupported');

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="font-bold text-base">{t('push.sectionTitle')}</h2>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-600">{statusLabel}</span>
        {status !== 'denied' && status !== 'unsupported' && status !== 'loading' ? (
          <button
            disabled={busy}
            onClick={() => void handleToggle()}
            aria-label={status === 'subscribed' ? t('push.disable') : t('push.enable')}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              status === 'subscribed' ? 'bg-primary' : 'bg-slate-200'
            } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                status === 'subscribed' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        ) : null}
      </div>
      {status === 'denied' ? (
        <p className="text-xs text-slate-500">
          {t('push.status.denied')} — ändra i webbläsarens inställningar.
        </p>
      ) : null}
    </section>
  );
}

const formatRel = (r: LatestRoundSummary | null) => {
  if (!r) return '-';
  if (r.relativeToPar === null) return `${r.totalScore}`;
  const sign = r.relativeToPar > 0 ? '+' : '';
  return `${sign}${r.relativeToPar}`;
};

export default function ProfilePage() {
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

      <NotificationsSection />

      <Link
        href="/profile/settings"
        className="btn-secondary text-center mt-2"
      >
        {t('settings.title')}
      </Link>
    </div>
  );
}
