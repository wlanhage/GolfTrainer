'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useFollowsApi, useUsersApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { UserAvatar } from '@/components/UserAvatar';
import type { FollowCounts, PublicUserProfile } from '@/lib/types';
import { Loader } from '@/components/Loader';

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams();
  const userId = String(params?.userId ?? '');
  const { me } = useAuth();
  const usersApi = useUsersApi();
  const followsApi = useFollowsApi();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [counts, setCounts] = useState<FollowCounts | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = me?.id === userId;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, c, status] = await Promise.all([
        usersApi.getPublicProfile(userId),
        followsApi.getCounts(userId),
        isSelf ? Promise.resolve({ isFollowing: false }) : followsApi.isFollowing(userId)
      ]);
      setProfile(p);
      setCounts(c);
      setIsFollowing(status.isFollowing);
    } catch {
      setError('Kunde inte hämta profilen.');
    }
  }, [usersApi, followsApi, userId, isSelf]);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [load, userId]);

  const toggleFollow = async () => {
    if (isSelf || isFollowing === null) return;
    setBusy(true);
    try {
      if (isFollowing) {
        await followsApi.unfollow(userId);
        setIsFollowing(false);
        setCounts((c) => (c ? { ...c, followerCount: Math.max(0, c.followerCount - 1) } : c));
      } else {
        await followsApi.follow(userId);
        setIsFollowing(true);
        setCounts((c) => (c ? { ...c, followerCount: c.followerCount + 1 } : c));
      }
    } catch (e) {
      const msg = (e as Error).message || 'Okänt fel';
      setError(`Kunde inte uppdatera följ-status: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  if (!profile) {
    if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
    return <Loader />;
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        <UserAvatar avatarImage={profile.avatarImage} displayName={profile.displayName} size={120} />
        <h1 className="text-2xl font-extrabold text-ink">{profile.displayName}</h1>
        {profile.homeClub ? <p className="text-slate-600">{profile.homeClub}</p> : null}
      </div>

      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => router.push(`/u/${userId}/followers`)}
          className="text-center"
        >
          <div className="text-xl font-extrabold text-ink">{counts?.followerCount ?? 0}</div>
          <div className="text-xs text-slate-600">Följare</div>
        </button>
        <button
          onClick={() => router.push(`/u/${userId}/following`)}
          className="text-center"
        >
          <div className="text-xl font-extrabold text-ink">{counts?.followingCount ?? 0}</div>
          <div className="text-xs text-slate-600">Följer</div>
        </button>
      </div>

      {!isSelf ? (
        <button
          onClick={() => void toggleFollow()}
          disabled={busy || isFollowing === null}
          className={isFollowing ? 'btn-secondary disabled:opacity-50' : 'btn-primary disabled:opacity-50'}
        >
          {isFollowing === null ? '...' : isFollowing ? 'Slutar följa' : 'Följ'}
        </button>
      ) : (
        <Link href="/profile" className="btn-secondary text-center">
          Redigera profil
        </Link>
      )}

      <section className="card flex flex-col gap-2">
        <h2 className="font-bold">Info</h2>
        <Row label="HCP" value={profile.handicap?.toString() ?? '-'} />
        <Row label="Hand" value={profile.dominantHand ?? '-'} />
        <Row label="Favoritklubba" value={profile.favoriteClub ?? '-'} hint="Klubban med flest registrerade slag i Caddy" />
      </section>

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-100 py-1.5">
      <div>
        <div className="text-sm text-slate-600">{label}</div>
        {hint ? <div className="text-[11px] text-slate-400">{hint}</div> : null}
      </div>
      <div className="text-ink font-semibold text-right">{value}</div>
    </div>
  );
}
