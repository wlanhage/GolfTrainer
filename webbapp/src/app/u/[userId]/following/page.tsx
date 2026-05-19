'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFollowsApi } from '@/lib/api';
import { FollowList } from '@/components/FollowList';
import type { FollowEntry } from '@/lib/types';

export default function UserFollowingPage() {
  const params = useParams();
  const userId = String(params?.userId ?? '');
  const api = useFollowsApi();
  const [entries, setEntries] = useState<FollowEntry[]>([]);

  useEffect(() => {
    if (!userId) return;
    api.listFollowing(userId).then(setEntries).catch(() => undefined);
  }, [api, userId]);

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-2xl font-extrabold">Följer</h1>
      <FollowList entries={entries} emptyText="Följer ingen ännu." />
    </div>
  );
}
