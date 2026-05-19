'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFollowsApi } from '@/lib/api';
import { FollowList } from '@/components/FollowList';
import type { FollowEntry } from '@/lib/types';

export default function UserFollowersPage() {
  const params = useParams();
  const userId = String(params?.userId ?? '');
  const api = useFollowsApi();
  const [entries, setEntries] = useState<FollowEntry[]>([]);

  useEffect(() => {
    if (!userId) return;
    api.listFollowers(userId).then(setEntries).catch(() => undefined);
  }, [api, userId]);

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-2xl font-extrabold">Följare</h1>
      <FollowList entries={entries} emptyText="Inga följare ännu." />
    </div>
  );
}
