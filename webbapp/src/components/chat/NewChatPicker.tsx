'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFollowsApi } from '@/lib/api';
import { UserAvatar } from '@/components/UserAvatar';
import type { MutualFollower } from '@/lib/types';

export function NewChatPicker({ onClose }: { onClose: () => void }) {
  const followsApi = useFollowsApi();
  const router = useRouter();
  const [mutuals, setMutuals] = useState<MutualFollower[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    followsApi
      .listMutualFollowers()
      .then(setMutuals)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [followsApi]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Välj en gemensam följare</h2>
        <button onClick={onClose} className="text-sm text-primary font-semibold">
          Tillbaka
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm text-center mt-4">Laddar...</p>
      ) : mutuals.length === 0 ? (
        <p className="text-slate-500 text-center mt-6">Du har inga gemensamma följare ännu.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {mutuals.map((m) => (
            <button
              key={m.userId}
              onClick={() => router.push(`/community/chat/${m.userId}`)}
              className="bg-white border border-border rounded-xl px-3 py-3 flex items-center gap-3 text-left"
            >
              <UserAvatar
                avatarImage={m.avatarImage}
                displayName={m.displayName}
                size={40}
              />
              <span className="font-semibold text-ink">{m.displayName}</span>
              <span className="text-slate-400 text-lg ml-auto">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
