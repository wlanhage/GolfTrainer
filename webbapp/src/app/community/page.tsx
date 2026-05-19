'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useFollowsApi, useUsersApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { UserAvatar } from '@/components/UserAvatar';
import { FollowList } from '@/components/FollowList';
import type { FollowEntry, PublicUserSummary } from '@/lib/types';

type Tab = 'search' | 'following' | 'followers';

export default function CommunityPage() {
  const { me } = useAuth();
  const usersApi = useUsersApi();
  const followsApi = useFollowsApi();

  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [following, setFollowing] = useState<FollowEntry[]>([]);
  const [followers, setFollowers] = useState<FollowEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (tab !== 'search') return;
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const list = await usersApi.search(q);
        setResults(list);
      } catch {
        setError('Sökning misslyckades.');
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, tab, usersApi]);

  useEffect(() => {
    if (!me?.id) return;
    if (tab === 'following') {
      followsApi.listFollowing(me.id).then(setFollowing).catch(() => undefined);
    } else if (tab === 'followers') {
      followsApi.listFollowers(me.id).then(setFollowers).catch(() => undefined);
    }
  }, [tab, followsApi, me?.id]);

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-3xl font-extrabold text-ink">Community</h1>

      <div className="flex gap-2 border-b border-border">
        {([
          { id: 'search' as const, label: 'Sök' },
          { id: 'following' as const, label: 'Jag följer' },
          { id: 'followers' as const, label: 'Mina följare' }
        ]).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 font-semibold text-sm border-b-2 ${
                active ? 'border-primary text-primary' : 'border-transparent text-slate-600'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'search' ? (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök på namn"
            className="input"
            autoFocus
          />
          {error ? <p className="text-red-600 text-sm">{error}</p> : null}
          {searching ? <p className="text-slate-500 text-sm">Söker...</p> : null}
          <div className="flex flex-col gap-2">
            {results.map((user) => (
              <Link
                key={user.id}
                href={`/u/${user.id}`}
                className="bg-white border border-border rounded-xl px-3 py-3 flex items-center gap-3"
              >
                <UserAvatar avatarImage={user.avatarImage} displayName={user.displayName} size={48} />
                <div className="flex-1">
                  <div className="font-bold text-ink">{user.displayName}</div>
                  <div className="text-xs text-slate-500">
                    {user.homeClub ?? 'Ingen hemmaklubb'} · HCP {user.handicap ?? '-'} · {user.dominantHand ?? '-'}
                  </div>
                </div>
                <span className="text-slate-400 text-lg">›</span>
              </Link>
            ))}
            {!searching && query.trim() && results.length === 0 ? (
              <p className="text-slate-500 text-sm text-center mt-3">Inga träffar.</p>
            ) : null}
          </div>
        </>
      ) : null}

      {tab === 'following' ? <FollowList entries={following} emptyText="Du följer ingen ännu. Sök upp en användare för att börja." /> : null}
      {tab === 'followers' ? <FollowList entries={followers} emptyText="Ingen följer dig ännu." /> : null}
    </div>
  );
}
