'use client';

import Link from 'next/link';
import { UserAvatar } from './UserAvatar';
import { formatDate } from '@/lib/format';
import type { FollowEntry } from '@/lib/types';

export function FollowList({ entries, emptyText }: { entries: FollowEntry[]; emptyText: string }) {
  if (entries.length === 0) {
    return <p className="text-slate-500 text-center mt-6">{emptyText}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <Link
          key={entry.userId}
          href={`/u/${entry.userId}`}
          className="bg-white border border-border rounded-xl px-3 py-3 flex items-center gap-3"
        >
          <UserAvatar displayName={entry.username} size={40} />
          <div className="flex-1">
            <div className="font-semibold text-ink">{entry.username}</div>
            <div className="text-xs text-slate-500">{formatDate(entry.followedAt)}</div>
          </div>
          <span className="text-slate-400 text-lg">›</span>
        </Link>
      ))}
    </div>
  );
}
