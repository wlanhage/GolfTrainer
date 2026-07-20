'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFollowsApi } from '@/lib/api';
import { useT } from '@/lib/i18n/I18nProvider';
import { formatRelativeShort } from '@/lib/format';
import { UserAvatar } from '@/components/UserAvatar';
import { RoundReactions } from '@/components/RoundReactions';
import { Skeleton } from '@/components/Skeleton';
import type { FollowingFeedEntry } from '@/lib/types';

const PAGE_SIZE = 8;

export default function ActivityPage() {
  const router = useRouter();
  const followsApi = useFollowsApi();
  const t = useT();

  const [items, setItems] = useState<FollowingFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const batch = await followsApi.getFollowingFeed(PAGE_SIZE, offset);
      if (append) {
        setItems((prev) => [...prev, ...batch]);
      } else {
        setItems(batch);
      }
      setHasMore(batch.length === PAGE_SIZE);
    },
    [followsApi],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPage(0, false)
      .catch(() => setItems([]))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchPage]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      await fetchPage(items.length, true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0">
        <button onClick={() => router.back()} className="text-slate-600">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-slate-800">{t('title.activity')}</h1>
      </header>

      {/* Content */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-24" rounded="xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-6 text-center mt-8">
            <p className="text-slate-600 text-sm">{t('activity.empty')}</p>
            <Link
              href="/community"
              className="inline-block mt-3 text-primary font-semibold text-sm"
            >
              {t('activity.findFriends')}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {items.map((entry) => (
                <div
                  key={entry.roundId}
                  className="bg-white border border-border rounded-xl overflow-hidden"
                >
                  <Link
                    href={`/play/round/${entry.roundId}/overview`}
                    className="p-4 flex items-center gap-4 active:bg-slate-50 transition-colors"
                  >
                    <UserAvatar displayName={entry.username} size={44} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-ink truncate">{entry.username}</p>
                        <p className="text-xs text-slate-400 shrink-0 ml-2">
                          {formatRelativeShort(entry.startedAt)}
                        </p>
                      </div>
                      <p className="text-sm text-slate-500 truncate mt-0.5">{entry.course}</p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-extrabold text-primary">{entry.totalScore}</p>
                    </div>
                  </Link>

                  {entry.hostPlayerId ? (
                    <div className="px-4 pb-3">
                      <RoundReactions
                        roundId={entry.roundId}
                        playerId={entry.hostPlayerId}
                        initialReactions={entry.reactions}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {hasMore && (
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="w-full mt-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                {loadingMore ? '...' : t('activity.loadMore')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
